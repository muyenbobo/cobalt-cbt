// ui.js
// Small helpers shared by every page: a DOM builder, time formatting, and
// the common header + nav (so it isn't copy-pasted into seven HTML files).

// el('div', { class: 'panel', onClick: fn }, 'text', childNode, ...)
// Text is always inserted as text (never as HTML), so data coming from the
// API can't inject markup.
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

// Show text in an element, or hide the element when text is empty.
function setMessage(node, text) {
  node.textContent = text || '';
  node.classList.toggle('hidden', !text);
}

// 3725 -> "1:02:05", 125 -> "02:05"
function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// 125 -> "2 min 5 sec" (used on the results page)
function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (h) parts.push(`${h} hr`);
  if (m) parts.push(`${m} min`);
  if (sec || parts.length === 0) parts.push(`${sec} sec`);
  return parts.join(' ');
}

function chipRow(subjects) {
  return el(
    'div',
    { class: 'chip-row', style: 'margin-top: 0' },
    (subjects || []).map((s) => el('span', { class: 'chip', text: s }))
  );
}

// Renders the brand header (and nav) into <div id="app-header"></div>.
//   active  — which nav tab to highlight: 'practice' | 'history' | 'books' | 'admin'
//   minimal — brand only, no nav (used on the login page and during a quiz)
function renderHeader({ active = '', minimal = false } = {}) {
  const host = document.getElementById('app-header');
  if (!host) return;

  const session = getSession();

  const pill = el('span', { class: 'api-pill hidden', id: 'api-pill' });

  const left = el(
    'div',
    { class: 'brand-block' },
    el('h1', { text: 'Cobalt' }),
    el('p', { class: 'tagline', text: 'Practice papers for JAMB-style exams' }),
    pill
  );

  const header = el('div', { class: 'ticket-header' }, left);

  if (session) {
    header.append(
      el(
        'div',
        { class: 'session-info' },
        `${session.username} · ${session.role}`,
        el('br'),
        el('button', { class: 'link-toggle', type: 'button', text: 'Log out', onClick: logout })
      )
    );
  }

  host.replaceChildren(header);

  if (session && !minimal) {
    const tabs = [
      ['practice', 'Practice', 'dashboard.html'],
      ['history', 'History', 'history.html'],
      ['books', 'Library', 'books.html'],
    ];
    if (session.role === 'admin') tabs.push(['admin', 'Admin', 'admin.html']);

    host.append(
      el(
        'div',
        { class: 'nav-row' },
        tabs.map(([key, label, href]) =>
          el('a', { class: `nav-tab${active === key ? ' active' : ''}`, href, text: label })
        )
      )
    );
  }

  watchApiStatus(pill);
}

// Shows "waking up" until the background wake-up ping (see api.js) finishes.
function watchApiStatus(pill) {
  if (apiStatus.state === 'ready') return; // already awake — show nothing

  pill.className = 'api-pill waking';
  pill.textContent = 'Waking up the server… first load can take up to a minute';

  apiReady.then((ok) => {
    if (ok) {
      pill.className = 'api-pill ready';
      pill.textContent = 'Server ready';
      setTimeout(() => pill.classList.add('hidden'), 2500);
    } else {
      pill.className = 'api-pill down';
      pill.textContent = "Can't reach the server — check your connection";
    }
  });
}
