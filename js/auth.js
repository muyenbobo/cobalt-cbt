// auth.js
// Session helpers shared by every page. The session lives in localStorage so
// it survives refreshes and new tabs: { token, role, username }.

const SESSION_KEY = 'cbt_session';

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Call at the top of every protected page. Returns the session,
// or sends the visitor to the login page and returns null.
function requireLogin() {
  const session = getSession();
  if (!session || !session.token) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

// Same as requireLogin, but non-admins are sent back to the dashboard.
function requireAdmin() {
  const session = requireLogin();
  if (!session) return null;
  if (session.role !== 'admin') {
    window.location.href = 'dashboard.html';
    return null;
  }
  return session;
}

function logout() {
  clearSession();
  sessionStorage.removeItem('cobalt_quiz');
  sessionStorage.removeItem('cobalt_last_result');
  window.location.href = 'index.html';
}
