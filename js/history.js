// history.js — the logged-in user's past attempts
(function () {
  const session = requireLogin();
  if (!session) return;
  renderHeader({ active: 'history' });

  const loading = document.getElementById('history-loading');
  const errorEl = document.getElementById('history-error');
  const empty = document.getElementById('history-empty');
  const list = document.getElementById('history-list');

  getMyResults(session.token)
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
              chipRow(r.subjects),
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
})();
