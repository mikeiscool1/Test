import { route } from "./router.js";
import { main as entry } from './index.js';
import { ReviewPermission } from "./constants.js";
import { Module, Score } from "./types/index";
import { popup, removePopup } from "./util.js";

export async function main() {
  const eExit = document.getElementById('exit')!;
  const eName = document.getElementById('name')!;
  const eScore = document.getElementById('score')!;
  const eScorePercentWrapper = document.getElementById('score-percent-wrapper')!;
  const eScorePercent = document.getElementById('score-percent')!;
  const eScorePoints = document.getElementById('score-points')!;
  const eReviewNumberWrong = document.getElementById('review-number-wrong')!;
  const eTotalQuestions = document.getElementById('total-questions')!;
  const eCorrectAnswers = document.getElementById('correct-answers')!;
  const eIncorrectAnswers = document.getElementById('incorrect-answers')!;
  const eReviewQuestions = document.getElementById('review-questions')!;
  const eThPoints = document.getElementById('th-points')!;
  const eThCorrectAnswer = document.getElementById('th-correct-answer')!;
  const eThYourAnswer = document.getElementById('th-your-answer')!;
  const eTableBody = document.getElementById('table-body')!;
  const eReviewQuestionPopup = document.getElementById('review-question-popup')!;
  const eCtxWrap = document.getElementById('context-wrapper')!;
  const eCtx = document.getElementById('context')!;
  const eCtxSplit = document.getElementById('context-split')!;
  const eTopQCurrent = document.getElementById('top-current-question')!;
  const eQuestionAndChoices = document.getElementById('question-choices')!;
  const eQuestion = document.getElementById('question')!;
  const eChoices = document.getElementById('choices')!;
  const eExplanationWrapper = document.getElementById('explanation-wrapper')!;
  const eExplanation = document.getElementById('explanation')!;

  const A = 'A'.charCodeAt(0);

  eExit.onclick = () => {
    localStorage.clear();
    window.location.href = '/entry';
  }

  const id = localStorage.getItem('test_id');
  const ticket = localStorage.getItem('ticket');

  if (!id || !ticket) {
    localStorage.clear();
    return route('entry.html', '/entry', entry);
  }

  const req = await fetch(`/api/${id}/results`, {
    headers: {
      'Authorization': ticket 
    }
  });

  const res = await req.json();

  const { test_name } = res;
  eName.innerHTML = test_name;

  if (req.status === 403 && res.code === 0) {
    eScore.innerHTML = 'INVALIDATED';
    eScorePercentWrapper.innerHTML = 'Your score is not available because your test was invalidated, either due to exiting the test or the test administrator\'s discretion.';
    eScorePercentWrapper.classList.remove('d-none');
    return;
  } else if (req.status === 403 && res.code === 2) {
    eScore.innerHTML = 'UNRELEASED';
    eScorePercentWrapper.innerHTML = 'Your score is not available because this test has not released scores yet.';
    eScorePercentWrapper.classList.remove('d-none');
    return;
  }

  const { score, modules, your_answers, review_permission, review_point_weight }: 
    { score: Score, modules: Module[], your_answers: number[], review_permission: ReviewPermission, review_point_weight: boolean } 
    = res;

  eScore.innerHTML = score.score;

  if (review_permission === ReviewPermission.NONE) return;

  eScorePercent.innerHTML = `${score.percentage}%`;
  eScorePoints.innerHTML = `${score.points_earned}/${score.total_possible_points}`;

  eTotalQuestions.innerHTML = score.total_questions.toString();
  eCorrectAnswers.innerHTML = (score.total_questions - score.total_wrong).toString();
  eIncorrectAnswers.innerHTML = score.total_wrong.toString();
  eScorePercentWrapper.classList.remove('d-none');
  
  eReviewNumberWrong.classList.remove('d-none');

  if (review_permission === ReviewPermission.NUMBER_WRONG) return;

  if (review_permission === ReviewPermission.QUESTION_NUMBERS) {
    eThCorrectAnswer.remove();
    eThYourAnswer.remove();
  }

  if (!review_point_weight) eThPoints.remove();

  let i = 0;
  for (const module of modules) {
    for (const q of module.questions) {
      const tr = document.createElement('tr');
      tr.id = `${module.number},${q.number},${your_answers?.[i]}`;

      const tdQ = document.createElement('td');
      tdQ.innerHTML = (q.number + 1).toString();
      const tdS = document.createElement('td');
      tdS.innerHTML = module.name;

      tr.append(tdQ, tdS);

      if (review_point_weight) {
        const tdP = document.createElement('td');
        tdP.innerHTML = q.points.toString();
        tr.appendChild(tdP);
      }

      if (review_permission === ReviewPermission.ANSWERS) {
        const tdCA = document.createElement('td');
        tdCA.innerHTML = String.fromCharCode(A + q.answer);
        const tdA = document.createElement('td');
        tdA.innerHTML = your_answers[i] !== -1 ? String.fromCharCode(A + your_answers[i]) : 'Omitted';

        tr.append(tdCA, tdA);
      }

      const tdStatus = document.createElement('td');
      if (score.wrong_answer_indices.includes(i)) {
        tdStatus.innerHTML = 'Incorrect';
        tdStatus.classList.add('text-danger');
      } else {
        tdStatus.innerHTML = 'Correct';
        tdStatus.classList.add('text-success');
      }

      tr.appendChild(tdStatus);
      
      eTableBody.append(tr);

      i++;
    }
  }

  eReviewQuestions.classList.remove('d-none');

  document.onclick = e => {
    const target = e.target as HTMLElement;

    if (target.classList.contains('btn-popup-close')) {
      removePopup(target.parentElement!.parentElement!);
      return;
    } else if (target.parentElement?.parentElement?.id === 'table-body') {
      const [moduleNumStr, questionNumStr, yourAnswer] = target.parentElement?.id.split(',');
      const moduleNum = +moduleNumStr;
      const questionNum = +questionNumStr;

      const question = modules.find(m => m.number === moduleNum)?.questions.find(q => q.number === questionNum);
      if (!question) return;

      if (question.context) {
        eCtxWrap.classList.remove('d-none');
        eCtxSplit.classList.remove('d-none');
  
        eQuestionAndChoices.classList.remove('mx-auto', 'w-75');
        eQuestionAndChoices.classList.add('w-50');
        eCtx.innerHTML = question.context;
      } else {
        eCtxWrap.classList.add('d-none');
        eCtxSplit.classList.add('d-none');
  
        eQuestionAndChoices.classList.remove('w-50');
        eQuestionAndChoices.classList.add('mx-auto', 'w-75');
  
        eCtx.innerHTML = '';
      }

      if (review_point_weight)
        eTopQCurrent.innerHTML = (questionNum + 1).toString() + 
          ` <span class="points">(${question.points} pt${question.points === 1 ? '' : 's'})</span>`
      else eTopQCurrent.innerHTML = (questionNum + 1).toString();
      eQuestion.innerHTML = question.question;
  
      eChoices.innerHTML = '';

      let i = 0;
      for (const c of question.choices) {
        const li = document.createElement('li');
        li.innerHTML = c;
        if (question.answer === i) li.classList.add('bg-correct');
        else if (+yourAnswer === i) li.classList.add('bg-incorrect');

        eChoices.appendChild(li);
        i++;
      }

      if (question.explanation) {
        eExplanation.innerHTML = question.explanation;
        eExplanationWrapper.classList.remove('d-none');
      }
      else {
        eExplanationWrapper.classList.add('d-none');
      }

      popup(eReviewQuestionPopup);
    }
  }
}
