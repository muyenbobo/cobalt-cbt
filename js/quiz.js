// quiz.js — the exam itself, with a countdown timer.
//
// How the timer works
// -------------------
// * dashboard.js saved the quiz (questions + durationSeconds) in sessionStorage.
// * The FIRST time this page opens, we stamp `deadline = now + duration` and
//   save it. From then on the timer always counts down to that fixed
//   deadline, so refreshing the page or leaving and coming back does NOT
//   reset or pause it.
// * Every second we recompute "deadline - Date.now()" (instead of doing
//   seconds-- ) so the clock stays correct even if the browser throttles
//   timers in a background tab.
// * At zero the quiz locks and submits automatically with whatever has been
//   answered.
(function () {
  const session = requireLogin();
  if (!session) return;
  renderHeader({ minimal: true }); // no nav links during an exam

  const QUIZ_KEY = 'cobalt_quiz';
  const RESULT_KEY = 'cobalt_last_result';
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const WARN_AT = 300; // seconds left -> amber
  const DANGER_AT = 60; // seconds left -> red + pulsing

  // ---------- load saved quiz ----------
  let quiz = null;
  try {
    quiz = JSON.parse(sessionStorage.getItem(QUIZ_KEY));
  } catch {
    quiz = null;
  }
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    window.location.replace('dashboard.html'); // nothing to take
    return;
  }

  const questions = quiz.questions;
  quiz.answers = quiz.answers || {};
  quiz.index = Math.min(Math.max(Number(quiz.index) || 0, 0), questions.length - 1);

  // Start the clock the first time the quiz page opens.
  if (!quiz.deadline) {
    quiz.startedAt = Date.now();
    quiz.deadline = quiz.startedAt + quiz.durationSeconds * 1000;
  }
  saveQuiz();

  function saveQuiz() {
    try {
      sessionStorage.setItem(QUIZ_KEY, JSON.stringify(quiz));
    } catch {
      // storage full/unavailable — the quiz still works, it just won't survive a refresh
    }
  }

  // ---------- elements ----------
  const counterEl = document.getElementById('quiz-counter');
  const timerEl = document.getElementById('quiz-timer');
  const fillEl = document.getElementById('timer-fill');
  const bannerEl = document.getElementById('time-banner');
  const textEl = document.getElementById('question-text');
  const optionsEl = document.getElementById('options');
  const jumperEl = document.getElementById('jumper');
  const errorEl = document.getElementById('quiz-error');
  const backBtn = document.getElementById('back-btn');
  const nextBtn = document.getElementById('next-btn');
  const submitBtn = document.getElementById('submit-btn');
  const quitBtn = document.getElementById('quit-btn');

  let locked = false; // true once time is up or while submitting
  let submitting = false;
  let retry = false; // true after a failed submit, so the button says "Retry submit"
  let timerId = null;
  let bannerTimeout = null;

  // ---------- rendering ----------
  function answeredCount() {
    return Object.keys(quiz.answers).length;
  }

  function render() {
    const q = questions[quiz.index];

    counterEl.textContent = `Q${String(quiz.index + 1).padStart(2, '0')} / ${String(
      questions.length
    ).padStart(2, '0')} · ${q.subject}`;

    textEl.textContent = q.question_text;

    optionsEl.replaceChildren(
      ...q.options.map((opt, i) =>
        el(
          'div',
          {
            class: `option-row${quiz.answers[q.id] === opt ? ' selected' : ''}${locked ? ' locked' : ''}`,
            onClick: () => selectAnswer(opt),
          },
          el('span', { class: 'option-letter', text: LETTERS[i] || String(i + 1) }),
          el('span', { text: opt })
        )
      )
    );

    jumperEl.replaceChildren(
      ...questions.map((item, i) =>
        el('button', {
          type: 'button',
          class: `jump-dot${i === quiz.index ? ' current' : ''}${quiz.answers[item.id] ? ' answered' : ''}`,
          text: String(i + 1),
          onClick: () => goTo(i),
        })
      )
    );

    backBtn.disabled = quiz.index === 0 || submitting;
    nextBtn.disabled = quiz.index === questions.length - 1 || submitting;
    nextBtn.classList.toggle('hidden', quiz.index === questions.length - 1);

    const unanswered = questions.length - answeredCount();
    submitBtn.textContent = submitting
      ? 'Submitting…'
      : retry
        ? 'Retry submit'
        : `Submit (${unanswered > 0 ? `${unanswered} unanswered` : 'all answered'})`;
    submitBtn.disabled = submitting;
  }

  function goTo(i) {
    if (submitting) return;
    quiz.index = Math.min(Math.max(i, 0), questions.length - 1);
    saveQuiz();
    render();
  }

  function selectAnswer(optionText) {
    if (locked) return;
    quiz.answers[questions[quiz.index].id] = optionText;
    saveQuiz();
    render();
  }

  // ---------- timer ----------
  function remainingSeconds() {
    return Math.max(0, Math.ceil((quiz.deadline - Date.now()) / 1000));
  }

  function showBanner(text, kind, autoHideMs) {
    clearTimeout(bannerTimeout);
    bannerEl.textContent = text;
    bannerEl.classList.toggle('danger', kind === 'danger');
    bannerEl.classList.remove('hidden');
    if (autoHideMs) {
      bannerTimeout = setTimeout(() => bannerEl.classList.add('hidden'), autoHideMs);
    }
  }

  // Remember which milestones already passed so a page refresh at 04:30
  // doesn't re-announce "5 minutes left".
  const announced = new Set();
  (function primeMilestones() {
    const left = remainingSeconds();
    if (left <= WARN_AT) announced.add('warn');
    if (left <= DANGER_AT) announced.add('danger');
  })();

  function tick() {
    const left = remainingSeconds();
    const total = quiz.durationSeconds;

    timerEl.textContent = formatClock(left);
    const warn = left <= WARN_AT && left > DANGER_AT;
    const danger = left <= DANGER_AT;
    timerEl.classList.toggle('timer-warn', warn);
    timerEl.classList.toggle('timer-danger', danger);
    fillEl.classList.toggle('timer-warn', warn);
    fillEl.classList.toggle('timer-danger', danger);
    fillEl.style.width = `${Math.max(0, Math.min(100, (left / total) * 100))}%`;

    if (left <= WARN_AT && !announced.has('warn') && left > DANGER_AT) {
      announced.add('warn');
      showBanner(`${Math.ceil(left / 60)} minutes left — start wrapping up.`, 'warn', 6000);
    }
    if (left <= DANGER_AT && !announced.has('danger') && left > 0) {
      announced.add('danger');
      showBanner('Less than 1 minute left!', 'danger', 6000);
    }

    if (left <= 0) {
      clearInterval(timerId);
      onTimeUp();
    }
  }

  function onTimeUp() {
    locked = true;
    render();
    showBanner("Time's up — submitting your answers…", 'danger');
    submit({ auto: true });
  }

  // ---------- submit ----------
  async function submit({ auto = false } = {}) {
    if (submitting) return;

    if (!auto) {
      const unanswered = questions.length - answeredCount();
      const message =
        unanswered > 0
          ? `You still have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. Submit anyway?`
          : 'Submit your answers now?';
      if (!confirm(message)) return;
    }

    setMessage(errorEl, '');
    submitting = true;
    locked = true;
    clearInterval(timerId);
    render();

    try {
      const payload = Object.entries(quiz.answers).map(([question_id, selected_answer]) => ({
        question_id,
        selected_answer,
      }));

      const result = await submitQuiz(payload, session.token);

      // The API can answer 200 with just a message when something is wrong.
      if (!result || result.percentage === undefined) {
        throw new Error((result && result.message) || 'The server did not return a score. Try submitting again.');
      }

      result.time_used_seconds = Math.min(
        quiz.durationSeconds,
        Math.round((Date.now() - quiz.startedAt) / 1000)
      );
      result.timed_out = auto;

      sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
      sessionStorage.removeItem(QUIZ_KEY);
      window.location.href = 'results.html';
    } catch (err) {
      // Let the user retry. Answers are still saved in sessionStorage.
      submitting = false;
      retry = true;
      setMessage(errorEl, err.message);

      // Manual submit failed with time still left: unlock and keep the clock running.
      // (If time is up, the quiz stays locked and only "Retry submit" works.)
      if (!auto && remainingSeconds() > 0) {
        locked = false;
        timerId = setInterval(tick, 1000);
      }
      render();
    }
  }

  // ---------- controls ----------
  backBtn.addEventListener('click', () => goTo(quiz.index - 1));
  nextBtn.addEventListener('click', () => goTo(quiz.index + 1));
  submitBtn.addEventListener('click', () => submit({ auto: locked && remainingSeconds() === 0 }));

  quitBtn.addEventListener('click', () => {
    if (submitting) return;
    if (!confirm('Quit this quiz? Your answers will be lost and nothing will be scored.')) return;
    clearInterval(timerId);
    sessionStorage.removeItem(QUIZ_KEY);
    window.location.href = 'dashboard.html';
  });

  // Keyboard: A-F picks an option, arrow keys move between questions.
  document.addEventListener('keydown', (e) => {
    if (submitting || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'ArrowRight') goTo(quiz.index + 1);
    else if (e.key === 'ArrowLeft') goTo(quiz.index - 1);
    else {
      const i = LETTERS.indexOf(e.key.toUpperCase());
      const q = questions[quiz.index];
      if (i !== -1 && e.key.length === 1 && q.options[i] !== undefined) selectAnswer(q.options[i]);
    }
  });

  // ---------- go ----------
  render();
  tick(); // paint the clock immediately

  if (remainingSeconds() > 0) {
    timerId = setInterval(tick, 1000);
  }
  // (if time already ran out while the user was away, tick() above has
  //  already fired onTimeUp() and is submitting)
})();
