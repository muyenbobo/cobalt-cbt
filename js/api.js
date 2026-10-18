// api.js
// Every network call lives here. Pages call these functions instead of
// writing raw fetch() calls.
//
// IMPORTANT: the API's CORS policy only allows requests from
// http://localhost:3000 — serve this folder on port 3000
// (e.g. `npx serve -l 3000`), using "localhost", not 127.0.0.1.
//
// Load order on every page: auth.js -> api.js -> ui.js -> page script.

const BASE_URL = 'https://cbt-api-tauf.onrender.com';

const NETWORK_ERROR =
  'Could not reach the server. It may still be waking up (free hosting) — wait a few seconds and try again.';

// ---------------------------------------------------------------
// Wake the API up as soon as the site is visited.
//
// The API is on Render's free tier and falls asleep after ~15 idle
// minutes; the first request then takes up to a minute. So the moment
// any page loads we fire a cheap background request. It uses
// mode:'no-cors' so it resolves as soon as the server answers (we don't
// need to read the reply), and it can't fail because of CORS.
// A sessionStorage stamp stops us re-pinging on every page change.
// ---------------------------------------------------------------

const WAKE_KEY = 'cobalt_api_wake';
const WAKE_WINDOW_MS = 10 * 60 * 1000;

const apiStatus = { state: 'waking' }; // 'waking' | 'ready' | 'down'

function recentlyAwake() {
  try {
    const stamp = Number(sessionStorage.getItem(WAKE_KEY));
    return stamp > 0 && Date.now() - stamp < WAKE_WINDOW_MS;
  } catch {
    return false;
  }
}

function wakeUpApi() {
  if (recentlyAwake()) {
    apiStatus.state = 'ready';
    return Promise.resolve(true);
  }
  return fetch(`${BASE_URL}/subjects`, { method: 'GET', mode: 'no-cors', cache: 'no-store' })
    .then(() => {
      apiStatus.state = 'ready';
      try {
        sessionStorage.setItem(WAKE_KEY, String(Date.now()));
      } catch {
        // storage unavailable — not a problem
      }
      return true;
    })
    .catch(() => {
      apiStatus.state = 'down';
      return false;
    });
}

// Started immediately when this script loads (i.e. on every page visit).
const apiReady = wakeUpApi();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------
// Core request helper
// ---------------------------------------------------------------

async function request(path, { method = 'GET', body, formData, token } = {}) {
  // If the wake-up ping is still in flight, wait for it (max 60s) so the
  // user's first click doesn't fail against a sleeping server.
  await Promise.race([apiReady, sleep(60000)]);

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (formData) {
    payload = formData; // the browser sets the multipart Content-Type itself
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new Error(NETWORK_ERROR);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // some responses have no body
  }

  // An expired/invalid token: send the user back to log in.
  if (res.status === 401 && token) {
    clearSession();
    try {
      sessionStorage.setItem('cobalt_notice', 'Your session expired. Please log in again.');
    } catch {
      // ignore
    }
    window.location.href = 'index.html';
    throw new Error('Your session expired. Please log in again.');
  }

  if (!res.ok) {
    const detail = data && (data.detail || data.message);
    throw new Error(typeof detail === 'string' ? detail : `Request failed (${res.status})`);
  }

  return data;
}

// --- Auth ---
// NOTE: this API returns HTTP 200 even for a failed login/register, with a
// {message: "..."} body instead of the expected fields. Callers must check
// for the expected field (access_token, ...), not just "did it succeed".

function registerUser(payload) {
  return request('/register', { method: 'POST', body: payload });
}

function loginUser(payload) {
  return request('/login', { method: 'POST', body: payload });
}

// --- Quiz ---

function getSubjects() {
  return request('/subjects');
}

function startQuiz(subjects, token) {
  // The API expects a raw JSON array of subject strings as the body.
  return request('/quiz/start', { method: 'POST', body: subjects, token });
}

function submitQuiz(answers, token) {
  // The API expects a raw JSON array of {question_id, selected_answer}.
  return request('/quiz/submit', { method: 'POST', body: answers, token });
}

function getMyResults(token) {
  return request('/results/me', { token });
}

// --- Books ---

function getBooks(token) {
  return request('/books', { token });
}

function searchBooks(query, token) {
  return request(`/books/search?query=${encodeURIComponent(query)}`, { token });
}

function readBook(title, token) {
  return request(`/books/read?title=${encodeURIComponent(title)}`, { token });
}

// --- Admin: questions ---
// There is no endpoint to list questions: only add / edit-by-id / delete-by-id.

function createQuestion(payload, token) {
  return request('/admin/questions', { method: 'POST', body: payload, token });
}

function editQuestion(id, payload, token) {
  return request(`/admin/questions/${encodeURIComponent(id)}`, { method: 'PUT', body: payload, token });
}

function deleteQuestion(id, token) {
  return request(`/admin/questions/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}

// --- Admin: users & results ---

function getUsers(token) {
  return request('/admin/users', { token });
}

function getAllResults(token) {
  return request('/admin/results', { token });
}

// --- Admin: books ---
// Create uses multipart/form-data (file upload). Edit sends title/author/
// category as query-string params because the API declares them as plain
// str params rather than a JSON body.

function createBook({ title, author, category, file }, token) {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('author', author);
  formData.append('category', category);
  formData.append('file', file);
  return request('/admin/books', { method: 'POST', formData, token });
}

function editBook(id, { title, author, category }, token) {
  const params = new URLSearchParams({ title, author, category });
  return request(`/admin/books/${encodeURIComponent(id)}?${params.toString()}`, { method: 'PUT', token });
}

function deleteBook(id, token) {
  return request(`/admin/books/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}

function readBookById(id, token) {
  return request(`/admin/books/${encodeURIComponent(id)}`, { token });
}
