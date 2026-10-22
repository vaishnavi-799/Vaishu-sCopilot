const API_BASE_URL = '';
const CHAT_API_URL = `${API_BASE_URL}/api/chat`;
const MAX_HISTORY_ITEMS = 20;
const CHAT_SESSION_ID = sessionStorage.getItem('vaishu-chat-session') || crypto.randomUUID();
const SESSION_TOKEN = sessionStorage.getItem('vaishu-session-token') || '';
const nativeFetch = window.fetch.bind(window);
window.fetch = (resource, options = {}) => nativeFetch(resource, { ...options, credentials: options.credentials || 'include' });
sessionStorage.setItem('vaishu-chat-session', CHAT_SESSION_ID);
const messages = document.getElementById('messages');
const form = document.getElementById('chatForm');
const input = document.getElementById('message');
const sendButton = document.getElementById('sendButton');
const typing = document.getElementById('typing');
const errorBox = document.getElementById('error');
const history = [];

function addMessage(role, text) {
  const wrapper = document.createElement('div'); wrapper.className = `message ${role}`;
  const avatar = document.createElement('div'); avatar.className = 'avatar'; avatar.textContent = role === 'assistant' ? 'V' : 'You';
  const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = text;
  wrapper.append(avatar, bubble); messages.appendChild(wrapper); messages.scrollTop = messages.scrollHeight;
}
function setLoading(value) { typing.hidden = !value; sendButton.disabled = value; input.disabled = value; if (value) messages.scrollTop = messages.scrollHeight; }
async function sendMessage(text) {
  const message = text.trim(); if (!message || message.length > 4000) return;
  errorBox.hidden = true; addMessage('user', message);
  const requestHistory = history.slice(-MAX_HISTORY_ITEMS); history.push({ role: 'user', content: message }); input.value = ''; setLoading(true);
  try {
    const response = await fetch(CHAT_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Chat-Session': CHAT_SESSION_ID, ...(SESSION_TOKEN ? { Authorization: `Bearer ${SESSION_TOKEN}` } : {}) }, body: JSON.stringify({ message, history: requestHistory }) });
    const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.detail || 'The assistant could not respond.');
    const answer = result.response || 'I could not generate a response. Please try again.'; history.push({ role: 'assistant', content: answer }); addMessage('assistant', answer);
  } catch (error) { errorBox.textContent = `${error.message} Check that the API is running and Gemini is configured.`; errorBox.hidden = false; }
  finally { setLoading(false); input.focus(); }
}
form.addEventListener('submit', event => { event.preventDefault(); sendMessage(input.value); });
input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
document.querySelectorAll('[data-question]').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.question; input.focus(); }));
window.vaishuChat = { getHistory: () => history.map(item => ({ ...item })), sendMessage };
async function restoreSession() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/session`, {
      headers: SESSION_TOKEN ? { Authorization: `Bearer ${SESSION_TOKEN}` } : {},
    });
    if (response.status === 401) {
      errorBox.textContent = 'Your session has expired. Sign in to restore your saved profile and progress.';
      errorBox.hidden = false;
      sendButton.disabled = true;
      input.disabled = true;
      const link = document.createElement('a');
      link.href = 'login.html';
      link.textContent = ' Sign in';
      errorBox.appendChild(link);
      return;
    }
    if (!response.ok) throw new Error('Could not restore your student session.');
    const result = await response.json();
    localStorage.setItem('vaishu-user-id', result.user_id);
    sendButton.disabled = false;
    input.disabled = false;
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
    sendButton.disabled = true;
    input.disabled = true;
  }
}

document.getElementById('signOutButton')?.addEventListener('click', async () => {
  try { await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' }); }
  finally {
    localStorage.removeItem('vaishu-user-id');
    sessionStorage.removeItem('vaishu-session-token');
    window.location.href = 'login.html';
  }
});
restoreSession();
