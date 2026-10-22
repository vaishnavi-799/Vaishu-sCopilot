const API_BASE_URL = '';
const API_URL = `${API_BASE_URL}/api/users/profile`;
const form = document.getElementById('profileForm');
const steps = [...document.querySelectorAll('.form-step')];
const indicators = [...document.querySelectorAll('#stepList li')];
const nextBtn = document.getElementById('nextBtn');
const backBtn = document.getElementById('backBtn');
const progressBar = document.getElementById('progressBar');
const stepCount = document.getElementById('stepCount');
let currentStep = 0;
let resumeFile = null;

function showStep(index) {
  currentStep = index;
  steps.forEach((step, i) => step.classList.toggle('active', i === index));
  indicators.forEach((item, i) => { item.classList.toggle('active', i === index); item.classList.toggle('done', i < index); });
  stepCount.textContent = `Step ${index + 1} of ${steps.length}`;
  progressBar.style.width = `${((index + 1) / steps.length) * 100}%`;
  backBtn.hidden = index === 0;
  nextBtn.textContent = index === steps.length - 1 ? 'Submit profile  →' : 'Continue  →';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateStep() {
  const required = [...steps[currentStep].querySelectorAll('[required]')];
  let valid = true;
  required.forEach(input => { const field = input.closest('.field'); const empty = !input.value.trim(); field?.classList.toggle('invalid', empty); if (empty) valid = false; });
  const email = steps[currentStep].querySelector('input[type=email]');
  if (email && email.value && !/^\S+@\S+\.\S+$/.test(email.value)) { email.closest('.field').classList.add('invalid'); valid = false; }
  if (currentStep === 0 && form.elements.password.value !== form.elements.confirm_password.value) {
    form.elements.confirm_password.closest('.field')?.classList.add('invalid');
    valid = false;
  }
  if (currentStep === 0 && form.elements.password.value.length < 12) {
    form.elements.password.closest('.field')?.classList.add('invalid');
    valid = false;
  }
  if (!valid) { steps[currentStep].querySelector('.invalid input, .invalid select, .invalid textarea')?.focus(); }
  return valid;
}

function addChip(input, value) {
  const clean = value.trim().replace(/,$/, ''); if (!clean) return;
  const hidden = document.querySelector(`input[type=hidden][name="${input.id}"]`);
  const holder = document.querySelector(`.chips[data-for="${input.id}"]`);
  const values = hidden.value ? hidden.value.split('|') : [];
  if (values.includes(clean)) return;
  values.push(clean); hidden.value = values.join('|');
  const chip = document.createElement('span'); chip.className = 'chip'; chip.innerHTML = `${clean} <button type="button" aria-label="Remove ${clean}">×</button>`;
  chip.querySelector('button').addEventListener('click', () => { hidden.value = values.filter(v => v !== clean).join('|'); chip.remove(); });
  holder.appendChild(chip); input.value = '';
}

document.querySelectorAll('.chip-input input').forEach(input => input.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addChip(input, input.value); } }));
document.querySelectorAll('.chip-input').forEach(box => box.addEventListener('click', () => box.querySelector('input').focus()));

function collectProfile() {
  const data = {}; new FormData(form).forEach((value, key) => { if (!['resume', 'password', 'confirm_password'].includes(key)) data[key] = value; });
  data.learning_style = [...form.querySelectorAll('input[name=learning_style]:checked')].map(x => x.value);
  ['programming_languages','technical_skills','tools_technologies','soft_skills'].forEach(key => { data[key] = data[key] ? data[key].split('|').filter(Boolean) : []; });
  return { personal_information: { full_name:data.full_name, preferred_name:data.preferred_name, email:data.email, phone_number:data.phone_number, date_of_birth:data.date_of_birth, gender:data.gender, current_city:data.current_city, country:data.country }, education:{ highest_education_level:data.highest_education_level, degree_course:data.degree_course, specialization_branch:data.specialization_branch, college_university:data.college_university, graduation_year:data.graduation_year ? Number(data.graduation_year) : null, current_education_status:data.current_education_status, year_semester:data.year_semester, subjects:data.subjects ? data.subjects.split(',').map(item => item.trim()).filter(Boolean) : [] }, career_information:{ current_status:data.current_status, target_job_role:data.target_job_role, preferred_industry:data.preferred_industry, preferred_work_location:data.preferred_work_location, experience_level:data.experience_level, current_company:data.current_company, current_job_role:data.current_job_role }, skills:{ programming_languages:data.programming_languages, technical_skills:data.technical_skills, tools_technologies:data.tools_technologies, soft_skills:data.soft_skills }, career_goals:{ short_term_career_goal:data.short_term_career_goal, long_term_career_goal:data.long_term_career_goal, target_role:data.target_role, target_companies:data.target_companies, areas_to_improve:data.areas_to_improve, preferred_learning_style:data.learning_style, interests:data.interests, preferred_difficulty:data.preferred_difficulty } };
}

function saveDraft() { const values = [...new FormData(form)].filter(([key]) => !['password', 'confirm_password', 'resume'].includes(key)); localStorage.setItem('vaishu-profile-draft', JSON.stringify(Object.fromEntries(values))); const button = document.getElementById('saveDraft'); button.innerHTML = 'Draft saved ✓'; setTimeout(() => button.innerHTML = 'Save & continue later <span>↗</span>', 1800); }
function restoreDraft() { const draft = JSON.parse(localStorage.getItem('vaishu-profile-draft') || 'null'); if (!draft) return; delete draft.password; delete draft.confirm_password; Object.entries(draft).forEach(([key,value]) => { const input = form.elements[key]; if (input && input.type !== 'file' && input.type !== 'checkbox') input.value = value; }); }

async function restoreSavedProfile() {
  const userId = localStorage.getItem('vaishu-user-id');
  if (!userId) return;
  try {
    const sessionToken = sessionStorage.getItem('vaishu-session-token');
    if (!sessionToken) return;
    const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(userId)}`, { credentials: 'include', headers: { Authorization: `Bearer ${sessionToken}` } });
    if (!response.ok) return;
    const profile = await response.json();
    const values = { ...(profile.personal_information || {}), ...(profile.education || {}), ...(profile.career_information || {}), ...(profile.career_goals || {}) };
    Object.entries(values).forEach(([key, value]) => {
      const input = form.elements[key];
      if (input && input.type !== 'file' && input.type !== 'checkbox' && !Array.isArray(value)) input.value = value ?? '';
    });
    if (values.preferred_difficulty) localStorage.setItem('vaishu-preferred-difficulty', values.preferred_difficulty);
    (profile.skills || {}).programming_languages && Object.entries(profile.skills).forEach(([key, items]) => {
      const input = document.getElementById(key);
      (items || []).forEach(item => input && addChip(input, item));
    });
    (values.preferred_learning_style || []).forEach(style => { const checkbox = form.querySelector(`input[name=learning_style][value="${CSS.escape(style)}"]`); if (checkbox) checkbox.checked = true; });
  } catch (_) { /* The chat remains usable if profile loading is unavailable. */ }
}

nextBtn.addEventListener('click', async () => { if (!validateStep()) return; if (currentStep < steps.length - 1) { showStep(currentStep + 1); return; } await submitProfile(); });
backBtn.addEventListener('click', () => showStep(Math.max(0, currentStep - 1)));
document.getElementById('saveDraft').addEventListener('click', saveDraft);
document.getElementById('skipResume').addEventListener('click', () => { resumeFile = null; if (currentStep === steps.length - 1) submitProfile(); });
const fileInput = document.getElementById('resume'), dropZone = document.getElementById('dropZone');
document.getElementById('browseBtn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
['dragenter','dragover'].forEach(event => dropZone.addEventListener(event, e => { e.preventDefault(); dropZone.classList.add('dragover'); }));
['dragleave','drop'].forEach(event => dropZone.addEventListener(event, e => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
dropZone.addEventListener('drop', e => handleFile(e.dataTransfer.files[0]));
function handleFile(file) { if (!file) return; const allowed = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']; if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) { alert('Please choose a PDF, DOC or DOCX file under 10 MB.'); return; } resumeFile = file; const name = document.getElementById('fileName'); name.hidden = false; name.textContent = `✓ ${file.name}`; }
async function submitProfile() { nextBtn.disabled = true; nextBtn.textContent = 'Sending…'; const message = document.getElementById('successMessage'); const payload = new FormData(); const profilePayload = collectProfile(); payload.append('profile_data', JSON.stringify(profilePayload)); if (resumeFile) payload.append('resume', resumeFile); try { const response = await fetch(API_URL, { method:'POST', body:payload }); const result = await response.json(); if (!response.ok) throw new Error(result.detail || 'Could not submit your profile.'); localStorage.setItem('vaishu-user-id', result.user_id); sessionStorage.setItem('vaishu-session-token', result.session_token); localStorage.setItem('vaishu-preferred-difficulty', profilePayload.career_goals.preferred_difficulty || 'Medium'); message.hidden = false; message.className = 'success-message'; message.textContent = `${result.created === false ? 'Profile loaded and updated' : 'Profile created'} successfully. Opening your personalized assistant…`; nextBtn.hidden = true; localStorage.removeItem('vaishu-profile-draft'); setTimeout(() => { window.location.href = 'chat.html'; }, 700); } catch (error) { message.hidden = false; message.className = 'success-message error'; message.textContent = `${error.message} Make sure the FastAPI server is running.`; nextBtn.disabled = false; nextBtn.textContent = 'Submit profile  →'; } }
async function restoreSavedProfile() {
  try {
    const legacyToken = sessionStorage.getItem('vaishu-session-token');
    const response = await fetch(`${API_BASE_URL}/api/auth/session`, {
      credentials: 'include',
      headers: legacyToken ? { Authorization: `Bearer ${legacyToken}` } : {},
    });
    if (response.status === 401) return;
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'Could not restore your saved profile.');
    const profile = result.profile;
    localStorage.setItem('vaishu-user-id', result.user_id);
    if (result.password_login_enabled) {
      form.elements.password.required = false;
      form.elements.confirm_password.required = false;
      form.elements.password.closest('.field').hidden = true;
      form.elements.confirm_password.closest('.field').hidden = true;
    }
    const values = { ...(profile.personal_information || {}), ...(profile.education || {}), ...(profile.career_information || {}), ...(profile.career_goals || {}) };
    Object.entries(values).forEach(([key, value]) => {
      const input = form.elements[key];
      if (input && input.type !== 'file' && input.type !== 'checkbox' && !Array.isArray(value)) input.value = value ?? '';
    });
    if (values.preferred_difficulty) localStorage.setItem('vaishu-preferred-difficulty', values.preferred_difficulty);
    Object.entries(profile.skills || {}).forEach(([key, items]) => {
      const input = document.getElementById(key);
      (items || []).forEach(item => input && addChip(input, item));
    });
    (values.preferred_learning_style || []).forEach(style => {
      const checkbox = form.querySelector(`input[name=learning_style][value="${CSS.escape(style)}"]`);
      if (checkbox) checkbox.checked = true;
    });
  } catch (error) {
    const message = document.getElementById('successMessage');
    if (message) { message.hidden = false; message.className = 'success-message error'; message.textContent = error.message; }
  }
}

restoreDraft(); restoreSavedProfile(); showStep(0);

const resumeStatus = document.getElementById('resumeStatus') || (() => {
  const status = document.createElement('div');
  status.id = 'resumeStatus'; status.className = 'resume-status'; status.setAttribute('role', 'status');
  document.getElementById('dropZone')?.appendChild(status); return status;
})();
if (fileInput) fileInput.accept = '.pdf,.docx';
document.querySelector('#dropZone small')?.replaceChildren(document.createTextNode('PDF or DOCX · max 10 MB'));
if (fileInput) fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file && !/\.pdf$|\.docx$/i.test(file.name)) {
    resumeFile = null; fileInput.value = ''; resumeStatus.textContent = 'Please choose a PDF or DOCX resume.';
    resumeStatus.className = 'resume-status error';
  } else if (file) {
    resumeStatus.textContent = 'Ready to upload and extract.'; resumeStatus.className = 'resume-status';
  }
});
nextBtn.addEventListener('click', () => {
  if (currentStep === steps.length - 1 && resumeFile) {
    resumeStatus.textContent = 'Uploading resume and extracting details…'; resumeStatus.className = 'resume-status';
  }
});

function profileRequestError(response, result) {
  const detail = result?.detail;
  if (response.status === 401) return 'Your session is missing or expired. Please submit onboarding again.';
  if (response.status === 404) return 'The resume upload service was not found. Restart the FastAPI backend.';
  if (response.status === 413) return detail || 'This resume is larger than the 10 MB limit.';
  if (response.status === 422) return detail || 'The resume could not be validated or extracted. Please upload a text-based PDF or DOCX.';
  if (response.status >= 500) return 'The server could not save this resume. Please try again and check the backend logs.';
  return detail || 'Could not submit your profile.';
}

async function submitProfileWithStatus() {
  nextBtn.disabled = true; nextBtn.textContent = 'Sending…';
  if (resumeFile) { resumeStatus.textContent = 'Uploading resume and extracting details…'; resumeStatus.className = 'resume-status'; }
  const message = document.getElementById('successMessage'); const payload = new FormData();
  const profilePayload = collectProfile(); payload.append('profile_data', JSON.stringify(profilePayload));
  if (form.elements.password.value) payload.append('password', form.elements.password.value);
  if (resumeFile) payload.append('resume', resumeFile, resumeFile.name);
  try {
    const response = await fetch(API_URL, { method: 'POST', body: payload, credentials: 'include' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(profileRequestError(response, result));
    localStorage.setItem('vaishu-user-id', result.user_id); sessionStorage.removeItem('vaishu-session-token');
    localStorage.setItem('vaishu-preferred-difficulty', profilePayload.career_goals.preferred_difficulty || 'Medium');
    message.hidden = false; message.className = 'success-message'; message.textContent = `${result.created === false ? 'Profile loaded and updated' : 'Profile created'} successfully. Opening your personalized assistant…`;
    nextBtn.hidden = true; localStorage.removeItem('vaishu-profile-draft'); setTimeout(() => { window.location.href = 'chat.html'; }, 700);
  } catch (error) {
    const networkMessage = error instanceof TypeError ? 'Could not reach the FastAPI backend. Check that port 8080 is running and that the frontend origin is allowed by CORS.' : error.message;
    message.hidden = false; message.className = 'success-message error'; message.textContent = networkMessage;
    nextBtn.disabled = false; nextBtn.textContent = 'Submit profile  →';
  }
}

nextBtn.addEventListener('click', event => {
  if (currentStep !== steps.length - 1) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (validateStep()) submitProfileWithStatus();
}, true);
document.getElementById('skipResume').addEventListener('click', event => {
  event.preventDefault(); event.stopImmediatePropagation(); resumeFile = null; submitProfileWithStatus();
}, true);
