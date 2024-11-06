import { Test } from "./Test.js";
import { popup, removePopup } from "./util.js";
import { main as entry } from './entry.js';
import { route } from "./router.js";

export function beginEvents(test: Test) {
  const eQuestionGrid = document.getElementById('question-grid')!;
  const eNext = document.getElementById('next')!;
  const eBack = document.getElementById('back')!;
  const eExit = document.getElementById('exit')!;

  const eReferencePopup = document.getElementById('reference-popup')!;
  const eReference = document.getElementById('reference')!;

  const eQuestionGridBtn = document.getElementById('open-question-grid')!;
  const eQuestionsPopup = document.getElementById('questions-popup')!;

  const eContinuePopup = document.getElementById('continue-popup')!;
  const eCantContinuePopup = document.getElementById('cant-continue-popup')!;
  const eContinuePopupBtn = document.getElementById('continue-continue')!;
  const eContinueWarning = document.getElementById('continue-warning')!;

  const eExitPopup = document.getElementById('exit-popup')!;
  const eExitExit = document.getElementById('exit-exit')!;

  eNext.onclick = () => {
    if (test.currentQuestion === test.module.questions.length - 1) {
      if (test.config.allow_early_continue) {
        if (test.answers.includes(-1)) eContinueWarning.classList.remove('d-none');
        else eContinueWarning.classList.add('d-none');
        
        popup(eContinuePopup);
        return;
      } else {
        popup(eCantContinuePopup);
        return;
      }
    }

    test.nextQuestion();
  }

  eBack.onclick = () => {
    if (eBack.classList.contains('disabled')) return;

    test.backQuestion();
  }

  document.oncontextmenu = e => {
    e.preventDefault();
  }

  document.onkeydown = e => {
    if (e.ctrlKey || e.metaKey) return e.preventDefault();
  }

  eExit.onclick = () => {
    popup(eExitPopup);
    return;
  }

  eExitExit.onclick = async() => {
    test.invalidate();
    document.exitFullscreen().catch(() => {});
    return route('entry.html', '/entry', entry);
  }

  eContinuePopupBtn.onclick = () => {
    removePopup(eContinuePopup);
    test.submitAnswers();
  }

  eReference.onclick = () => {
    popup(eReferencePopup);
    return;
  }

  eQuestionGridBtn.onclick = () => {
    popup(eQuestionsPopup);
    return;
  }

  document.onclick = e => {
    const target = e.target as HTMLElement;

    if (target.classList.contains('btn-popup-close')) {
      removePopup(target.parentElement!.parentElement!);
      return;
    } else if (target.parentElement?.id === 'questions-grid') {
      test.currentQuestion = +Array.from(target.children)[0].innerHTML - 1;
      removePopup(target.parentElement!.parentElement!);
      return;
    } else if (target.parentElement?.id === 'choices') {
      for (const c of target.parentElement.children) c.classList.remove('selected');
      target.classList.add('selected');
      
      const index = Array.from(target.parentElement.children).indexOf(target);
      
      test.answer = index;
    }
  }
}