// index.js — login + register page
(function () {
  // Already logged in? Skip straight to the app.
  if (getSession() && getSession().token) {
    window.location.href = 'dashboard.html';
    return;
  }

  renderHeader({ minimal: true });

  const title = document.getElementById('auth-title');
  const sub = document.getElementById('auth-sub');
  const notice = document.getElementById('auth-notice');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');
  const loginBtn = document.getElementById('login-btn');
  const registerBtn = document.getElementById('register-btn');
  const toggleText = document.getElementById('toggle-text');
  const toggleBtn = document.getElementById('toggle-btn');

  let mode = 'login';

  // A message left by another page (e.g. "session expired").
  const leftover = sessionStorage.getItem('cobalt_notice');
  if (leftover) {
    setMessage(notice, leftover);
    sessionStorage.removeItem('cobalt_notice');
  }

  function setMode(next) {
    mode = next;
    const isLogin = mode === 'login';
    title.textContent = isLogin ? 'Log in' : 'Create your account';
    sub.textContent = isLogin
      ? 'Enter your credentials to resume practice.'
      : 'Register to start tracking your practice scores.';
    loginForm.classList.toggle('hidden', !isLogin);
    registerForm.classList.toggle('hidden', isLogin);
    toggleText.textContent = isLogin ? 'No account yet?' : 'Already registered?';
    toggleBtn.textContent = isLogin ? 'Register' : 'Log in';
    setMessage(loginError, '');
    setMessage(registerError, '');
  }

  toggleBtn.addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));

  // ---------- login ----------
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
      setMessage(loginError, 'Enter your username and password.');
      return;
    }

    setMessage(loginError, '');
    setMessage(notice, '');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in…';

    try {
      const res = await loginUser({ username, password });
      // The API answers 200 even on failure, so check for the token itself.
      if (!res || !res.access_token) {
        setMessage(loginError, (res && res.message) || 'Invalid username or password.');
        return;
      }
      saveSession({ token: res.access_token, role: res.role, username });
      window.location.href = 'dashboard.html';
    } catch (err) {
      setMessage(loginError, err.message);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Log in';
    }
  });

  // ---------- register ----------
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = {
      first_name: document.getElementById('first_name').value.trim(),
      last_name: document.getElementById('last_name').value.trim(),
      date_of_birth: document.getElementById('dob').value.trim(),
      email: document.getElementById('email').value.trim(),
      username: document.getElementById('reg_username').value.trim(),
      password: document.getElementById('reg_password').value.trim(),
    };

    if (Object.values(form).some((v) => !v)) {
      setMessage(registerError, 'Fill in every field before registering.');
      return;
    }
    if (form.password.length < 4) {
      setMessage(registerError, 'Password must be at least 4 characters.');
      return;
    }

    setMessage(registerError, '');
    registerBtn.disabled = true;
    registerBtn.textContent = 'Registering…';

    try {
      const res = await registerUser(form);
      const message = res && res.message;
      if (message && message.toLowerCase().includes('successfully registered')) {
        registerForm.reset();
        setMode('login');
        setMessage(notice, 'Account created. You can log in now.');
      } else {
        setMessage(registerError, message || 'Could not register. Try a different username.');
      }
    } catch (err) {
      setMessage(registerError, err.message);
    } finally {
      registerBtn.disabled = false;
      registerBtn.textContent = 'Register';
    }
  });
})();
