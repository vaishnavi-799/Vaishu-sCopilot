const API_BASE_URL = '';
const loginForm = document.getElementById('loginForm');
const authMessage = document.getElementById('authMessage');

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = loginForm.querySelector('button[type=submit]');
  submit.disabled = true;
  authMessage.hidden = true;
  const data = new FormData(loginForm);
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || (response.status === 401 ? 'Email or password is incorrect.' : 'Sign-in failed.'));
    localStorage.setItem('vaishu-user-id', result.user_id);
    sessionStorage.removeItem('vaishu-session-token');
    const target = new URLSearchParams(window.location.search).get('next');
    const allowedPages = new Set(['dashboard.html', 'skills.html', 'performance.html', 'jobs.html', 'resume.html', 'learning.html', 'profile.html', 'chat.html']);
    window.location.href = allowedPages.has(target) ? target : 'dashboard.html';
  } catch (error) {
    authMessage.textContent = error instanceof TypeError ? 'Could not connect to the sign-in service. Check that the backend is running.' : error.message;
    authMessage.hidden = false;
  } finally { submit.disabled = false; }
});
