import { PrismaClient, ReviewPermission } from '@prisma/client';
import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import { Score } from './types';
const scoreQuery = fs.readFileSync('./sql/score.sql').toString();

const app = express();
app.use(bodyParser.json());
app.use(express.static('../public'));

const fileOptions = {
  root: '../public'
}

const db = new PrismaClient();

app.get('/api/:testId', async (req, res) => {
  const testId = req.params.testId;
  const { authorization } = req.headers;
  if (!authorization) return void res.status(401).send({ message: 'Missing ticket.' });

  const test = await db.test.findUnique({ where: { id: testId } });
  if (!test) return void res.status(404).send({ message: 'Test not found.' });

  if (!test.tickets.includes(authorization)) return void res.status(403).send({ message: 'Invalid ticket.' });

  delete (test as any).tickets;

  return void res.send({
    config: test
  });
});

app.post('/api/:testId/begin', async (req, res) => {
  const testId = req.params.testId;
  const { authorization } = req.headers;
  if (!authorization) return void res.sendStatus(401);

  const test = await db.test.findUnique({ where: { id: testId } });
  if (!test) return void res.sendStatus(404);

  if (!test.tickets.includes(authorization)) return void res.sendStatus(403);
 
  const module = await db.module.findUnique({
    where: { number_test_id: { number: 0, test_id: test.id } }
  });

  if (!module) return void res.status(500).send({ message: 'Could not locate the module.' });

  const questions = await db.question.findMany({
    where: { module_id: module.id },
    select: {
      number: true,
      question: true,
      context: true,
      points: true,
      choices: true
    }
  });

  if (!questions) return void res.status(500).send({ message: 'Could not locate the questions.' });

  test.tickets.splice(test.tickets.indexOf(authorization), 1);

  await db.test.update({
    where: { id: test.id },
    data: {
      tickets: test.tickets
    }
  });

  await db.answer.create({
    data: {
      ticket: authorization,
      test_id: test.id
    }
  });

  delete (test as any).tickets;

  return void res.send({
    config: test,
    module: { ...module, questions }
  });
});

app.post('/api/:testId/answers', async (req, res) => {
  const testId = req.params.testId;
  const { authorization } = req.headers;
  if (!authorization) return void res.sendStatus(401);
  const { answers } = req.body;
  if (!Array.isArray(answers)) return void res.status(400);

  const answer = await db.answer.findUnique({
    where: { ticket_test_id: { ticket: authorization, test_id: testId }}
  });

  if (!answer) return void res.sendStatus(404);
  if (answer.invalid) return void res.status(403).send({ message: 'Your test was invalidated.', code: 0 });
  if (answer.finished) return void res.status(403).send({ message: 'You already finished the test.', code: 1 });
  if (answer.module_answers_received) return void res.status(403).send({ message: 'You already submitted the answers for this module. Go to the next module.', code: 2 });

  const module = await db.module.findUnique({
    where: { number_test_id: { number: answer.current_module, test_id: testId } }
  });

  if (!module) return void res.sendStatus(500);

  const questions = await db.question.findMany({
    where: { module_id: module.id }
  })

  if (answers.length !== questions.length) return void res.status(400).send({ message: 'Mismatch number of questions.' });

  const nModules = await db.module.count({
    where: { test_id: testId }
  });

  // give an additional 10 seconds to submit your answers; this is not reflected on the client side.
  if (module.time && Date.now() - answer.start_module_at.getTime() - 10000 >= module.time) {
    await db.answer.update({
      where: { ticket_test_id: { ticket: authorization, test_id: testId } },
      data: {
        answers: { push: new Array(questions.length).fill(-1) },
        module_answers_received: true,
        finished: answer.current_module === nModules - 1
      }
    });

    return void res.status(403).send({ message: 'You ran out of time to submit your answers. You may still continue to the next module.', code: 2 });
  }

  for (let i = 0; i < answers.length; i++) {
    const ans = answers[i];
    if (ans === -1) continue;
    if (typeof ans !== 'number') return void res.status(400).send({ message: `Question ${i + 1}: invalid answer format.` });
    if (ans >= questions[i].choices.length) return void res.status(400).send({ message: `Question ${i + 1}: invalid answer.` });
  }

  await db.answer.update({
    where: { ticket_test_id: { ticket: authorization, test_id: testId } },
    data: {
      answers: { push: answers },
      module_answers_received: true,
      finished: answer.current_module === nModules - 1
    }
  });

  return void res.send({
    continue: answer.current_module !== nModules - 1
  });
});

app.get('/api/:testId/current', async (req, res) => {
  const testId = req.params.testId;
  const { authorization } = req.headers;
  if (!authorization) return void res.sendStatus(401);

  const answer = await db.answer.findUnique({
    where: { ticket_test_id: { ticket: authorization, test_id: testId } },
  });

  if (!answer) return void res.status(404).send({ message: 'Test not found.' });
  if (answer.invalid) return void res.status(403).send({ message: 'Your test was invalidated.', code: 0 });
  if (answer.finished) return void res.status(403).send({ message: 'You already finished the test.', code: 1 });

  let module = await db.module.findUnique({
    where: { number_test_id: { number: answer.current_module, test_id: testId } }
  });

  if (!module) return void res.sendStatus(500);

  let refreshStartTime = false;

  if (module.time && Date.now() - answer.start_module_at.getTime() >= module.time) {
    const nModules = await db.module.count({
      where: { test_id: testId }
    });

    if (answer.current_module === nModules - 1) {
      await db.answer.update({
        where: { ticket_test_id: { ticket: authorization, test_id: testId } },
        data: {
          finished: true
        }
      });

      return void res.status(403).send({ message: 'You already finished the test.', code: 1 });
    } else {
      refreshStartTime = true;

      const nQuestions = await db.question.count({
        where: { module_id: module.id }
      });

      await db.answer.update({
        where: { ticket_test_id: { ticket: authorization, test_id: testId } },
        data: {
          answers: { push: new Array(nQuestions).fill(-1) },
          current_module: answer.current_module + 1,
          start_module_at: new Date(),
          module_answers_received: false
        }
      });

      module = (await db.module.findUnique({
        where: { number_test_id: { number: answer.current_module + 1, test_id: testId } },
      }))!;
    }
  }

  const questions = await db.question.findMany({
    where: { module_id: module!.id },
    select: {
      number: true,
      question: true,
      context: true,
      points: true,
      choices: true
    }
  });

  if (!questions) return void res.sendStatus(500);

  const test = await db.test.findUnique({
    where: { id: module.test_id }
  });

  return void res.send({
    config: test,
    module: { ...module, questions },
    refresh_start_time: refreshStartTime
  });
});

app.get('/api/:testId/next', async (req, res) => {
  const testId = req.params.testId;
  const { authorization } = req.headers;
  if (!authorization) return void res.sendStatus(401);

  const answer = await db.answer.findUnique({
    where: { ticket_test_id: { ticket: authorization, test_id: testId } }
  });

  if (!answer) return void res.sendStatus(404);
  if (answer.invalid) return void res.status(403).send({ message: 'Your test was invalidated.', code: 0 });
  if (answer.finished) return void res.status(403).send({ message: 'You already finished the test.', code: 1 });

  if (!answer.module_answers_received) return void res.status(403).send({ message: 'Submit answers from the previous module before continuing. Even if the time is up, still request to submit your answers, and continue after getting an error.', code: 2 });

  const module = await db.module.findUnique({
    where: { number_test_id: { number: answer.current_module + 1, test_id: testId }},
    include: { test: true }
  });

  if (!module) return void res.sendStatus(500);

  if (module.time && !module.test.allow_early_continue && Date.now() - answer.start_module_at.getTime() < module.time)
    return void res.status(403).send({ message: 'This test does not allow early continuation. Please wait for your time to finish before continuing.'});

  await db.answer.update({
    where: { ticket_test_id: { ticket: authorization, test_id: testId } },
    data: {
      current_module: answer.current_module + 1,
      module_answers_received: false,
      start_module_at: new Date()
    }
  });

  const questions = await db.question.findMany({
    where: { module_id: module.id },
    select: {
      number: true,
      question: true,
      context: true,
      points: true,
      choices: true
    }
  });

  if (!questions) return void res.sendStatus(500);

  return void res.send({
    module: { ...module, questions }
  });
});

const convertPrismaResult = (result: any): Score => {
  return {
    points_earned: Number(result.points_earned),
    total_possible_points: Number(result.total_possible_points),
    percentage: Number(result.percentage),
    total_questions: Number(result.total_questions),
    total_wrong: Number(result.total_wrong),
    wrong_answer_indices: result.wrong_answer_indices.map(Number),
    score: result.score // Keep as string since it could be letter grade or "Pass"/"Fail"
  };
};

app.get('/api/:testId/results', async (req, res) => {
  const testId = req.params.testId;
  const { authorization } = req.headers;
  if (!authorization) return void res.sendStatus(401);

  const answer = await db.answer.findUnique({
    where: { ticket_test_id: { ticket: authorization, test_id: testId } },
    include: { test: { 
      include: { 
        modules: { 
          include: { 
            questions: { 
              orderBy: { number: 'asc' }
            } 
          },
          orderBy: {
            number: 'asc'
          }
        } 
      } 
    } 
  }});

  if (!answer) return void res.status(404).send({ message: 'Submission not found.' });
  if (answer.invalid) return void res.status(403).send({ message: 'Your test was invalidated.', code: 0 });
  if (!answer.finished) return void res.status(403).send({ message: 'You have not finished the test.', code: 1 });
  if (!answer.test.results_available) return void res.status(403).send({ message: 'Results are not available.', code: 2 });

  const scoreArr = await db.$queryRawUnsafe(scoreQuery, authorization) as any[];
  if (scoreArr.length === 0) return void res.sendStatus(500);

  const score = convertPrismaResult(scoreArr[0]);
  const { test } = answer;
  
  switch (test.review_permission) {
    case ReviewPermission.NONE:
      delete (score as any).points_earned;
      delete (score as any).total_possible_points;
      delete (score as any).percentage;
      delete (score as any).total_questions;
      delete (score as any).total_wrong;
      delete (score as any).wrong_answer_indices;

      return void res.send({ score, review_permission: ReviewPermission.NONE });
    case ReviewPermission.NUMBER_WRONG:
      delete (score as any).wrong_answer_indices;
      return void res.send({ score, review_permission: ReviewPermission.NUMBER_WRONG });
    case ReviewPermission.QUESTION_NUMBERS:
      test.modules.forEach(m => m.questions.forEach((q: any) => {
        delete q.answer;
        delete q.explanation;
      }));

      return void res.send({ score, modules: test.modules, review_permission: ReviewPermission.QUESTION_NUMBERS })
    case ReviewPermission.ANSWERS:
      return void res.send({ score, modules: test.modules, your_answers: answer.answers, review_permission: ReviewPermission.ANSWERS, review_point_weight: test.review_point_weight });
  }
});

app.post('/api/:testId/invalidate', async (req, res) => {
  const testId = req.params.testId;
  const { authorization } = req.headers;
  if (!authorization) return void res.sendStatus(401);

  const answer = await db.answer.findUnique({
    where: { ticket_test_id: { ticket: authorization, test_id: testId }}
  });

  if (!answer) return void res.sendStatus(404);

  await db.answer.update({
    where: { ticket_test_id: { ticket: authorization, test_id: testId }},
    data: {
      invalid: true
    }
  });

  return void res.sendStatus(204);
})

app.get('/', async (req, res) => {
  return void res.sendFile('entry.html', fileOptions);
});

app.get('/entry', async (req, res) => {
  return void res.sendFile('entry.html', fileOptions);
});

app.get('/:path', async (req, res) => {
  return void res.sendFile('entry.html', fileOptions);
})

app.listen(process.env.PORT, () => console.log(`Listening on port ${process.env.PORT}.`));