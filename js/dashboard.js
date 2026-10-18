// dashboard.js — pick subjects + time limit, start a quiz
(function () {
  const session = requireLogin();
  if (!session) return;
  renderHeader({ active: 'practice' });

  const QUIZ_KEY = 'cobalt_quiz';
  const RESULT_KEY = 'cobalt_last_result';
  const SECONDS_PER_QUESTION = 60; // used by the "Auto" time limit
  const MAX_SUBJECTS = 4;

  const grid = document.getElementById('subject-grid');
  const loadingNote = document.getElementById('subjects-loading');
  const emptyNote = document.getElementById('subjects-empty');
  const errorEl = document.getElementById('dash-error');
  const startBtn = document.getElementById('start-btn');
  const timeLimit = document.getElementById('time-limit');
  const resumeBox = document.getElementById('resume-box');

  let selected = [];

  // ---------- resume a quiz already in progress ----------
  function getSavedQuiz() {
    try {
      const quiz = JSON.parse(sessionStorage.getItem(QUIZ_KEY));
      return quiz && Array.isArray(quiz.questions) && quiz.questions.length ? quiz : null;
    } catch {
      return null;
    }
  }

  function renderResumeBox() {
    const quiz = getSavedQuiz();
    if (!quiz) {
      resumeBox.classList.add('hidden');
      return;
    }
    const answered = Object.keys(quiz.answers || {}).length;
    const timeUp = quiz.deadline && Date.now() >= quiz.deadline;

    resumeBox.replaceChildren(
      el('p', { style: 'font-weight: 500;', text: 'You have a quiz in progress' }),
      el('p', {
        class: 'stat-line',
        text: `${(quiz.subjects || []).join(', ')} · ${answered} of ${quiz.questions.length} answered${
          timeUp ? ' · time is up' : ''
        }`,
      }),
      el(
        'div',
        { class: 'btn-row' },
        el('a', {
          class: 'btn btn-gold',
          href: 'quiz.html',
          style: 'text-decoration: none;',
          text: timeUp ? 'Submit my answers' : 'Resume quiz',
        }),
        el('button', {
          class: 'btn btn-ghost',
          type: 'button',
          text: 'Discard it',
          onClick: () => {
            if (!confirm('Discard this quiz? Your answers will be lost.')) return;
            sessionStorage.removeItem(QUIZ_KEY);
            renderResumeBox();
          },
        })
      )
    );
    resumeBox.classList.remove('hidden');
  }

  renderResumeBox();

  // ---------- subjects ----------
  function renderSubjects(subjects) {
    grid.replaceChildren(
      ...subjects.map((subject) => {
        const checked = selected.includes(subject);
        const tick = el(
          'div',
          {
            class: `subject-tick${checked ? ' checked' : ''}`,
            role: 'checkbox',
            'aria-checked': String(checked),
            tabindex: '0',
            onClick: () => toggle(subject, subjects),
            onKeydown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle(subject, subjects);
              }
            },
          },
          el('span', { class: 'tickbox', text: checked ? '✓' : '' }),
          subject
        );
        return tick;
      })
    );
  }

  function toggle(subject, subjects) {
    if (selected.includes(subject)) {
      selected = selected.filter((s) => s !== subject);
    } else if (selected.length < MAX_SUBJECTS) {
      selected = [...selected, subject];
    } else {
      setMessage(errorEl, `You can pick at most ${MAX_SUBJECTS} subjects.`);
      return;
    }
    setMessage(errorEl, '');
    renderSubjects(subjects);
  }

  getSubjects()
    .then((res) => {
      const subjects = (res && res.subjects) || [];
      loadingNote.classList.add('hidden');
      if (subjects.length === 0) {
        emptyNote.classList.remove('hidden');
        return;
      }
      renderSubjects(subjects);
      startBtn.disabled = false;
    })
    .catch((err) => {
      loadingNote.classList.add('hidden');
      setMessage(errorEl, err.message);
    });

  // ---------- start ----------
  startBtn.addEventListener('click', async () => {
    if (selected.length < 1) {
      setMessage(errorEl, 'Pick between 1 and 4 subjects first.');
      return;
    }
    if (getSavedQuiz() && !confirm('Starting a new quiz will discard the one in progress. Continue?')) {
      return;
    }

    setMessage(errorEl, '');
    startBtn.disabled = true;
    startBtn.textContent = 'Preparing quiz…';

    try {
      const res = await startQuiz(selected, session.token);
      const questions = (res && res.questions) || [];
      if (questions.length === 0) {
        setMessage(
          errorEl,
          `No questions came back for: ${selected.join(', ')}. ` +
            'Try one subject on its own — if a subject has no questions, the whole combination can come back empty.'
        );
        return;
      }

      const durationSeconds =
        timeLimit.value === 'auto' ? questions.length * SECONDS_PER_QUESTION : Number(timeLimit.value);

      // startedAt / deadline stay null here — the countdown begins when
      // quiz.html actually opens (see quiz.js).
      sessionStorage.setItem(
        QUIZ_KEY,
        JSON.stringify({
          questions,
          subjects: selected,
          answers: {},
          index: 0,
          durationSeconds,
          startedAt: null,
          deadline: null,
        })
      );
      sessionStorage.removeItem(RESULT_KEY);
      window.location.href = 'quiz.html';
    } catch (err) {
      setMessage(errorEl, err.message);
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = 'Start quiz';
    }
  });
})();
