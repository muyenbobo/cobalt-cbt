// admin.js — admin-only tools: questions, users, all results, books
(function () {
  const session = requireAdmin(); // sends non-admins to the dashboard
  if (!session) return;
  renderHeader({ active: 'admin' });

  const token = session.token;

  // ====================================================================
  // Tabs (questions / users / results / books)
  // ====================================================================
  const tabs = document.querySelectorAll('#admin-tabs .nav-tab');
  const sections = {
    questions: document.getElementById('section-questions'),
    users: document.getElementById('section-users'),
    results: document.getElementById('section-results'),
    books: document.getElementById('section-books'),
  };
  const loaded = { users: false, results: false, books: false };

  function showSection(name) {
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.section === name));
    Object.entries(sections).forEach(([key, node]) => node.classList.toggle('hidden', key !== name));

    // Load each list the first time its tab is opened.
    if (name === 'users' && !loaded.users) {
      loaded.users = true;
      loadUsers();
    }
    if (name === 'results' && !loaded.results) {
      loaded.results = true;
      loadResults();
    }
    if (name === 'books' && !loaded.books) {
      loaded.books = true;
      loadBooks();
    }
  }

  tabs.forEach((t) => t.addEventListener('click', () => showSection(t.dataset.section)));

  // ====================================================================
  // QUESTIONS
  // ====================================================================
  const qId = document.getElementById('q-id');
  const qSubject = document.getElementById('q-subject'); // dropdown
  const qSubjectNew = document.getElementById('q-subject-new'); // shown for "add a new subject"
  const qSubjectHint = document.getElementById('q-subject-hint');
  const NEW_SUBJECT = '__new__';
  const qText = document.getElementById('q-text');
  const qOpts = Array.from(document.querySelectorAll('.q-opt'));
  const qAnswer = document.getElementById('q-answer');
  const qForm = document.getElementById('question-form');
  const qError = document.getElementById('q-error');
  const qNotice = document.getElementById('q-notice');
  const qSubmit = document.getElementById('q-submit');
  const qDelete = document.getElementById('q-delete');
  const qClear = document.getElementById('q-clear');

  // ---- Subject dropdown ----
  // Filled from the same /subjects list the dashboard uses, so the spelling
  // always matches exactly what students pick. "Add a new subject…" reveals a
  // text box for a subject that isn't in the list yet.
  let knownSubjects = [];

  async function loadSubjectChoices(selectValue) {
    try {
      const res = await getSubjects();
      knownSubjects = (res && res.subjects) || [];
    } catch (err) {
      setMessage(qError, `Could not load the subject list (${err.message}). You can still add a new subject.`);
    }

    qSubject.replaceChildren(
      el('option', { value: '', text: 'Select a subject' }),
      ...knownSubjects.map((name) => el('option', { value: name, text: name })),
      el('option', { value: NEW_SUBJECT, text: '+ Add a new subject…' })
    );
    qSubject.value = selectValue && [...qSubject.options].some((o) => o.value === selectValue) ? selectValue : '';
    refreshSubjectInput();
  }

  function refreshSubjectInput() {
    const adding = qSubject.value === NEW_SUBJECT;
    qSubjectNew.classList.toggle('hidden', !adding);
    qSubjectHint.textContent = adding
      ? 'Use lowercase and the spelling students should see, e.g. "physics".'
      : 'Pick from the same list students see on the dashboard.';
    if (adding) qSubjectNew.focus();
  }

  // The final subject string to send to the API.
  function chosenSubject() {
    if (qSubject.value === NEW_SUBJECT) return qSubjectNew.value.trim().toLowerCase();
    return qSubject.value;
  }

  qSubject.addEventListener('change', refreshSubjectInput);

  // The "correct answer" dropdown is built from whatever options are filled in.
  function refreshAnswerChoices() {
    const previous = qAnswer.value;
    const filled = qOpts.map((o) => o.value.trim()).filter(Boolean);

    qAnswer.replaceChildren(
      el('option', { value: '', text: 'Select the correct option' }),
      ...filled.map((text) => el('option', { value: text, text }))
    );
    if (filled.includes(previous)) qAnswer.value = previous;
  }

  // Editing an existing question (id typed) vs adding a new one (id blank).
  function refreshMode() {
    const editing = qId.value.trim() !== '';
    qSubmit.textContent = editing ? 'Save changes' : 'Add question';
    qDelete.classList.toggle('hidden', !editing);
  }

  function resetQuestionForm() {
    qId.value = '';
    qSubject.value = '';
    qSubjectNew.value = '';
    refreshSubjectInput();
    qText.value = '';
    qOpts.forEach((o) => (o.value = ''));
    refreshAnswerChoices();
    refreshMode();
  }

  qOpts.forEach((o) => o.addEventListener('input', refreshAnswerChoices));
  qId.addEventListener('input', refreshMode);
  qClear.addEventListener('click', () => {
    resetQuestionForm();
    setMessage(qError, '');
    setMessage(qNotice, '');
  });

  qForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage(qError, '');
    setMessage(qNotice, '');

    const options = qOpts.map((o) => o.value.trim());
    const subject = chosenSubject();
    const questionText = qText.value.trim();
    const answer = qAnswer.value;

    if (!subject) {
      setMessage(qError, 'Choose a subject, or pick "Add a new subject…" and type one.');
      return;
    }
    if (!questionText) {
      setMessage(qError, 'Question text is required.');
      return;
    }
    if (options.some((o) => !o)) {
      setMessage(qError, 'All 4 options are required.');
      return;
    }
    if (!answer || !options.includes(answer)) {
      setMessage(qError, 'Pick the correct answer from the options.');
      return;
    }

    const payload = { subject, question_text: questionText, options, answer };
    const editingId = qId.value.trim();

    qSubmit.disabled = true;
    try {
      const res = editingId
        ? await editQuestion(editingId, payload, token)
        : await createQuestion(payload, token);
      const message = res && res.message;
      if (message && message.toLowerCase().includes('success')) {
        const wasNew = qSubject.value === NEW_SUBJECT;
        resetQuestionForm();
        await loadSubjectChoices('');
        if (wasNew && !knownSubjects.includes(subject)) {
          // Saved, but the API's subject list doesn't include it, so students
          // can't pick it on the dashboard yet.
          setMessage(
            qNotice,
            `${message} — but "${subject}" isn't in the API's subject list yet, so students won't see it on the dashboard.`
          );
        } else {
          setMessage(qNotice, message);
        }
      } else {
        setMessage(qError, message || 'Something went wrong.');
      }
    } catch (err) {
      setMessage(qError, err.message);
    } finally {
      qSubmit.disabled = false;
    }
  });

  qDelete.addEventListener('click', async () => {
    const id = qId.value.trim();
    if (!id) {
      setMessage(qError, 'Enter a question id to delete.');
      return;
    }
    if (!confirm(`Delete question ${id}? This cannot be undone.`)) return;

    setMessage(qError, '');
    setMessage(qNotice, '');
    qDelete.disabled = true;
    try {
      const res = await deleteQuestion(id, token);
      setMessage(qNotice, (res && res.message) || 'Deleted.');
      resetQuestionForm();
    } catch (err) {
      setMessage(qError, err.message);
    } finally {
      qDelete.disabled = false;
    }
  });

  refreshAnswerChoices();
  refreshMode();
  loadSubjectChoices('');

  // ====================================================================
  // USERS
  // ====================================================================
  function loadUsers() {
    const loading = document.getElementById('users-loading');
    const errorEl = document.getElementById('users-error');
    const empty = document.getElementById('users-empty');
    const list = document.getElementById('users-list');

    getUsers(token)
      .then((res) => {
        const users = Array.isArray(res) ? res : [];
        loading.classList.add('hidden');
        if (users.length === 0) {
          empty.classList.remove('hidden');
          return;
        }
        list.replaceChildren(
          ...users.map((u) =>
            el(
              'div',
              { class: 'history-row' },
              el(
                'div',
                {},
                el(
                  'p',
                  { style: 'margin: 0; font-weight: 500;' },
                  `${u.first_name} ${u.last_name} `,
                  el('span', { class: 'chip', text: u.role })
                ),
                el('p', { class: 'history-date', text: `${u.username} · ${u.email}` })
              )
            )
          )
        );
      })
      .catch((err) => {
        loading.classList.add('hidden');
        setMessage(errorEl, err.message);
      });
  }

  // ====================================================================
  // ALL RESULTS
  // ====================================================================
  function loadResults() {
    const loading = document.getElementById('results-loading');
    const errorEl = document.getElementById('results-error');
    const empty = document.getElementById('results-empty');
    const list = document.getElementById('results-list');

    getAllResults(token)
      .then((res) => {
        const results = Array.isArray(res) ? res : [];
        loading.classList.add('hidden');
        if (results.length === 0) {
          empty.classList.remove('hidden');
          return;
        }
        const sorted = [...results].sort((a, b) => (a.date_taken < b.date_taken ? 1 : -1));
        list.replaceChildren(
          ...sorted.map((r) =>
            el(
              'div',
              { class: 'history-row' },
              el(
                'div',
                {},
                el('p', { class: 'mono-small', text: r.user_id }),
                el('div', { style: 'margin-top: 0.3rem;' }, chipRow(r.subjects)),
                el('p', { class: 'history-date', text: new Date(r.date_taken).toLocaleString() })
              ),
              el('div', { class: 'history-score', text: r.percentage })
            )
          )
        );
      })
      .catch((err) => {
        loading.classList.add('hidden');
        setMessage(errorEl, err.message);
      });
  }

  // ====================================================================
  // BOOKS
  // ====================================================================
  const bForm = document.getElementById('book-form');
  const bTitle = document.getElementById('b-title');
  const bAuthor = document.getElementById('b-author');
  const bCategory = document.getElementById('b-category');
  const bFile = document.getElementById('b-file');
  const bSubmit = document.getElementById('b-submit');
  const bError = document.getElementById('books-admin-error');
  const bNotice = document.getElementById('books-admin-notice');
  const bLoading = document.getElementById('books-admin-loading');
  const bEmpty = document.getElementById('books-admin-empty');
  const bList = document.getElementById('books-admin-list');

  let books = [];
  let editingBookId = null;
  let busy = false;

  function renderBooks() {
    bEmpty.classList.toggle('hidden', books.length > 0 || !bLoading.classList.contains('hidden'));

    bList.replaceChildren(
      ...books.map((b) => (editingBookId === b.id ? editRow(b) : viewRow(b)))
    );
  }

  function viewRow(b) {
    return el(
      'div',
      { class: 'book-row' },
      el('p', { class: 'book-title', text: b.title }),
      el(
        'p',
        { class: 'book-meta' },
        `${b.author} · ${b.category} · `,
        el('span', { style: 'font-family: var(--font-mono);', text: b.id })
      ),
      el(
        'div',
        { class: 'btn-row', style: 'margin-top: 0;' },
        el('button', {
          class: 'btn btn-ghost',
          type: 'button',
          text: 'Edit',
          onClick: () => {
            editingBookId = b.id;
            renderBooks();
          },
        }),
        el('button', {
          class: 'btn btn-ghost',
          type: 'button',
          text: 'Delete',
          onClick: () => removeBook(b),
        })
      )
    );
  }

  function editRow(b) {
    const title = el('input', { type: 'text', value: b.title });
    const author = el('input', { type: 'text', value: b.author });
    const category = el('input', { type: 'text', value: b.category });

    return el(
      'div',
      { class: 'book-row' },
      el('label', { text: 'Title' }),
      title,
      el('label', { text: 'Author' }),
      author,
      el('label', { text: 'Category' }),
      category,
      el(
        'div',
        { class: 'btn-row' },
        el('button', {
          class: 'btn btn-gold',
          type: 'button',
          text: 'Save',
          onClick: () =>
            saveBook(b.id, {
              title: title.value.trim(),
              author: author.value.trim(),
              category: category.value.trim(),
            }),
        }),
        el('button', {
          class: 'btn btn-ghost',
          type: 'button',
          text: 'Cancel',
          onClick: () => {
            editingBookId = null;
            renderBooks();
          },
        })
      )
    );
  }

  async function loadBooks() {
    bLoading.classList.remove('hidden');
    try {
      const res = await getBooks(token);
      books = Array.isArray(res) ? res : [];
    } catch (err) {
      setMessage(bError, err.message);
    } finally {
      bLoading.classList.add('hidden');
      renderBooks();
    }
  }

  async function saveBook(id, fields) {
    if (!fields.title || !fields.author || !fields.category) {
      setMessage(bError, 'Title, author and category cannot be empty.');
      return;
    }
    setMessage(bError, '');
    setMessage(bNotice, '');
    try {
      const res = await editBook(id, fields, token);
      setMessage(bNotice, (res && res.message) || 'Updated.');
      editingBookId = null;
      await loadBooks();
    } catch (err) {
      setMessage(bError, err.message);
    }
  }

  async function removeBook(b) {
    if (!confirm(`Delete "${b.title}"? This cannot be undone.`)) return;
    setMessage(bError, '');
    setMessage(bNotice, '');
    try {
      const res = await deleteBook(b.id, token);
      setMessage(bNotice, (res && res.message) || 'Deleted.');
      await loadBooks();
    } catch (err) {
      setMessage(bError, err.message);
    }
  }

  bForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;

    const upload = {
      title: bTitle.value.trim(),
      author: bAuthor.value.trim(),
      category: bCategory.value.trim(),
      file: bFile.files[0],
    };

    setMessage(bError, '');
    setMessage(bNotice, '');

    if (!upload.title || !upload.author || !upload.category || !upload.file) {
      setMessage(bError, 'Fill in every field and choose a .txt file.');
      return;
    }

    busy = true;
    bSubmit.disabled = true;
    bSubmit.textContent = 'Uploading…';
    try {
      const res = await createBook(upload, token);
      setMessage(bNotice, (res && res.message) || 'Uploaded.');
      bForm.reset();
      await loadBooks();
    } catch (err) {
      setMessage(bError, err.message);
    } finally {
      busy = false;
      bSubmit.disabled = false;
      bSubmit.textContent = 'Upload';
    }
  });
})();
