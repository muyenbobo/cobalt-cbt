// books.js — library: search, list, expand a book to read it
(function () {
  const session = requireLogin();
  if (!session) return;
  renderHeader({ active: 'books' });

  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const loading = document.getElementById('books-loading');
  const errorEl = document.getElementById('books-error');
  const empty = document.getElementById('books-empty');
  const list = document.getElementById('books-list');

  let books = [];
  let openTitle = null; // which book is expanded
  let openContent = '';
  let openBusy = false;

  function render() {
    const isLoading = !loading.classList.contains('hidden');
    const hasError = !errorEl.classList.contains('hidden');
    empty.classList.toggle('hidden', isLoading || hasError || books.length > 0);

    list.replaceChildren(
      ...books.map((b) => {
        const isOpen = openTitle === b.title;
        return el(
          'div',
          { class: 'book-row' },
          el('p', { class: 'book-title', text: b.title }),
          el('p', { class: 'book-meta', text: `${b.author} · ${b.category}` }),
          el('button', {
            class: 'btn btn-ghost',
            type: 'button',
            text: isOpen ? 'Hide' : 'Read',
            onClick: () => toggleBook(b.title),
          }),
          isOpen ? el('div', { class: 'book-content', text: openBusy ? 'Loading…' : openContent }) : null
        );
      })
    );
  }

  async function toggleBook(title) {
    if (openTitle === title) {
      openTitle = null;
      render();
      return;
    }
    openTitle = title;
    openBusy = true;
    openContent = '';
    render();

    try {
      const res = await readBook(title, session.token);
      openContent = res && res.content ? res.content : (res && res.message) || 'Could not load this book.';
    } catch (err) {
      openContent = err.message;
    } finally {
      openBusy = false;
      // Only redraw if the user hasn't opened something else meanwhile.
      if (openTitle === title) render();
    }
  }

  async function load(fetcher) {
    loading.classList.remove('hidden');
    setMessage(errorEl, '');
    openTitle = null;
    try {
      const res = await fetcher();
      books = Array.isArray(res) ? res : [];
    } catch (err) {
      books = [];
      setMessage(errorEl, err.message);
    } finally {
      loading.classList.add('hidden');
      render();
    }
  }

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) {
      load(() => getBooks(session.token));
    } else {
      load(() => searchBooks(query, session.token));
    }
  });

  load(() => getBooks(session.token));
})();
