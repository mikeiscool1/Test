import { TestConfig, Module } from "./types/index";
import { msToTime } from "./util.js";
import { beginEvents} from "./events.js";
import { route } from "./router.js";
import { main as done } from './done.js';
import { main as entry } from './entry.js';

let intervalId = 0;

let eModule = document.getElementById('module')!;
let eTime = document.getElementById('time')!;
let eName = document.getElementById('name')!;
let eBottomQCurrent = document.getElementById('bottom-question-current')!;
let eBottomQTotal = document.getElementById('bottom-question-total')!;
let eCtxWrap = document.getElementById('context-wrapper')!;
let eCtx = document.getElementById('context')!;
let eCtxSplit = document.getElementById('context-split')!;
let eTopQCurrent = document.getElementById('top-current-question')!;
let eQuestionAndChoices = document.getElementById('question-choices')!;
let eQuestion = document.getElementById('question')!;
let eChoices = document.getElementById('choices')!;
let eReference = document.getElementById('reference')!;
let eReferenceImg = document.getElementById('reference-img') as HTMLImageElement;
let eQuestionsGrid = document.getElementById('questions-grid')!;

let eNext = document.getElementById('next')!;
let eBack = document.getElementById('back')!;

export class Test {
  public config: TestConfig = null!;
  public ticket: string = null!;
  public module: Module = null!;
  private _currentQuestion = 0;
  public answers: number[] = [];

  constructor() {
    eModule = document.getElementById('module')!;
    eTime = document.getElementById('time')!;
    eName = document.getElementById('name')!;
    eBottomQCurrent = document.getElementById('bottom-question-current')!;
    eBottomQTotal = document.getElementById('bottom-question-total')!;
    eCtxWrap = document.getElementById('context-wrapper')!;
    eCtx = document.getElementById('context')!;
    eCtxSplit = document.getElementById('context-split')!;
    eTopQCurrent = document.getElementById('top-current-question')!;
    eQuestionAndChoices = document.getElementById('question-choices')!;
    eQuestion = document.getElementById('question')!;
    eChoices = document.getElementById('choices')!;
    eReference = document.getElementById('reference')!;
    eReferenceImg = document.getElementById('reference-img') as HTMLImageElement;
    eQuestionsGrid = document.getElementById('questions-grid')!;

    eNext = document.getElementById('next')!;
    eBack = document.getElementById('back')!;
  }

  public get currentQuestion() {
    return this._currentQuestion;
  }

  public get answer() {
    return this.answers[this._currentQuestion];
  }

  public set answer(a: number) {
    this.answers[this._currentQuestion] = a;
    localStorage.setItem('answers', JSON.stringify(this.answers));
    
    const gridQ = document.getElementById(`gq-${this._currentQuestion}`);
    if (gridQ) gridQ.classList.add('answered');
  }

  public set currentQuestion(question: number) {
    if (question < 0 || question >= this.module.questions.length)
      throw new Error('set currentQuestion: invalid question number.');

    this._currentQuestion = question;
    localStorage.setItem('current_question', question.toString());

    this.renderQuestion();
  }

  private renderEverything() {
    eModule.innerHTML = this.module.name;
    eName.innerHTML = this.config.name;

    if (!this.module.reference_image) eReference.classList.add('d-none');
    else {
      eReference.classList.remove('d-none');
      eReferenceImg.src = this.module.reference_image;
    }

    eQuestionsGrid.innerHTML = '';
    for (let i = 1; i <= this.module.questions.length; i++) {
      const h5 = document.createElement('h5');
      h5.innerHTML = i.toString();

      const div = document.createElement('div');
      div.id = `gq-${i - 1}`;

      div.appendChild(h5);

      if (this.answers[i - 1] !== -1) div.classList.add('answered');

      eQuestionsGrid.appendChild(div);
    }
    
    if (this.module.time) {
      eTime.innerHTML = msToTime(this.module.time - (Date.now() - +(localStorage.getItem('start_module_time') || 0)));
      this.beginClock();
    }

    this.renderQuestion();
  }

  private renderQuestion() {
    eBottomQCurrent.innerHTML = (this._currentQuestion + 1).toString();
    eBottomQTotal.innerHTML = this.module.questions.length.toString();

    const question = this.module.questions[this._currentQuestion];
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

    if (this.config.show_point_weight)
      eTopQCurrent.innerHTML = (this._currentQuestion + 1).toString() + 
        ` <span class="points">(${question.points} pt${question.points === 1 ? '' : 's'})</span>`
    else eTopQCurrent.innerHTML = (this._currentQuestion + 1).toString();
    eQuestion.innerHTML = question.question;

    eChoices.innerHTML = '';
    for (const c of question.choices) {
      const li = document.createElement('li');
      li.innerHTML = c;
      eChoices.appendChild(li);
    }

    if (this._currentQuestion == 0) eBack.classList.add('disabled');
    else eBack.classList.remove('disabled');

    const answer = this.answers[this._currentQuestion];
    if (answer !== -1) {
      Array.from(eChoices.children)[answer].classList.add('selected');
    }
  }

  private beginClock() {
    if (intervalId) clearInterval(intervalId);

    const startDate = Date.now();
    const time = this.module.time! - (startDate - +(localStorage.getItem('start_module_time') || 0));

    intervalId = setInterval(() => {
      const remaining = time - (Date.now() - startDate);
      if (remaining <= 0) {
        clearInterval(intervalId);
        this.submitAnswers();
        return;
      }

      eTime.innerHTML = msToTime(remaining);
    }, 1000);
  }

  public nextQuestion() {
    if (this._currentQuestion == this.module.questions.length - 1) throw new Error('nextQuestion(): end of module.');
    this.currentQuestion = this._currentQuestion + 1;
  }

  public backQuestion() {
    if (this._currentQuestion == 0) throw new Error('backQuestion(): already at question 0.');
    this.currentQuestion = this._currentQuestion - 1;
  }

  public async begin(testId: string, ticket: string) {
    const req = await fetch(`/api/${testId}/begin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': ticket
      }
    });

    if (!req.ok) {
      if (req.status === 404) return alert('Test not found.');
      else if (req.status === 403) {
        const req = await fetch(`/api/${testId}/current`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': ticket
          }
        });

        if (req.status === 404) {
          console.error('Invalid ticket.');
          localStorage.clear();
          return route('entry.html', '/entry', entry)
        }

        const res = await req.json();
        if (!req.ok) {
          console.error(res.message);
          localStorage.clear();
          return route('entry.html', '/entry', entry);
        }

        const { config, module, refresh_start_time } = res;

        this.config = config;
        this.module = module;
        this.ticket = ticket;

        const moduleN = localStorage.getItem('module_n');
        if (moduleN === null || +moduleN !== module.number) {
          localStorage.removeItem('answers');
          localStorage.removeItem('current_question');
        }
        
        const answers = localStorage.getItem('answers');
        if (answers) {
          try {
            const answersJson = JSON.parse(answers);
            this.answers = answersJson;
          } catch {
            this.answers = new Array(this.module.questions.length).fill(-1);
            localStorage.setItem('answers', JSON.stringify(this.answers));
          }
        } else {
          this.answers = new Array(this.module.questions.length).fill(-1);
          localStorage.setItem('answers', JSON.stringify(this.answers));
        }

        const currentQuestion = localStorage.getItem('current_question');
        if (currentQuestion) this.currentQuestion = +currentQuestion;

        localStorage.setItem('module_n', module.number);
        if (refresh_start_time) localStorage.setItem('start_module_time', Date.now().toString());

        this.renderEverything();
        beginEvents(this);

        return;
      } else {
        console.error('Unexpected error.');
        localStorage.clear();

        return route('entry.html', '/entry', entry);
      }
    }

    const { config, module } = await req.json();

    this.config = config;
    this.module = module;
    this.ticket = ticket;

    localStorage.setItem('start_module_time', Date.now().toString());
    localStorage.setItem('current_question', '0');
    this.answers = new Array(this.module.questions.length).fill(-1);
    localStorage.setItem('answers', JSON.stringify(this.answers));
    localStorage.setItem('module_n', '0');

    this.renderEverything();
    beginEvents(this);
  }

  public async submitAnswers() {
    console.log(this.answers);
    
    const req = await fetch(`/api/${this.config.id}/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.ticket
      },
      body: JSON.stringify({ answers: this.answers })
    });

    if (req.status === 404) return alert('Failed to submit answers: this test no longer exists.');

    const res = await req.json();
    if (!req.ok) {
      // if the answers were already submitted, we will just continue, assuming this is an error.
      if (res.code !== 2) return alert(res.message);
      else return this.requestNextModule();
    }

    if (intervalId) clearInterval(intervalId);

    //
    if (res.continue) {
      this.requestNextModule();
    } else {
      document.exitFullscreen().catch(() => {});
      localStorage.setItem('test_id', this.config.id);
      route('done.html', null, done);
    }
  }

  private async requestNextModule() {
    const req = await fetch(`/api/${this.config.id}/next`, {
      headers: {
        'Authorization': this.ticket
      }
    });

    if (!req.ok) {
      if (req.status === 500) return alert('An error occoured.');
      
      const res = await req.json();

      return alert(res.message);
    }

    const res = await req.json();

    const { module } = res;
    this.module = module;

    localStorage.setItem('start_module_time', Date.now().toString());
    localStorage.setItem('current_question', '0');
    this.answers = new Array(this.module.questions.length).fill(-1);
    localStorage.setItem('answers', JSON.stringify(this.answers));
    localStorage.setItem('module_n', module.number.toString());

    this.currentQuestion = 0;

    this.renderEverything();
  }

  public async invalidate() {
    await fetch(`/api/${this.config.id}/invalidate`, {
      method: 'POST',
      headers: {
        'Authorization': this.ticket
      }
    });

    localStorage.clear();
  }
}