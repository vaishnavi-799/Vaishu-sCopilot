const API_BASE_URL = '';
const USERS_API_URL = `${API_BASE_URL}/api/users`;
const SESSION_TOKEN = sessionStorage.getItem('vaishu-session-token') || '';
const nativeFetch = window.fetch.bind(window);
window.fetch = (resource, options = {}) => nativeFetch(resource, { ...options, credentials: options.credentials || 'include' });
const USER_HEADERS = SESSION_TOKEN ? { Authorization: `Bearer ${SESSION_TOKEN}` } : {};
const grid = document.getElementById('profileGrid');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('emptyState');
const statusBox = document.getElementById('status');
const detailPanel = document.getElementById('detailPanel');
const detailTitle = document.getElementById('detailTitle');
const detailContent = document.getElementById('detailContent');

function valueOrDash(value) { return value === undefined || value === null || value === '' ? '—' : String(value); }
function dateLabel(value) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? valueOrDash(value) : date.toLocaleDateString(undefined, { day:'2-digit', month:'short', year:'numeric' }); }
function initials(name) { return valueOrDash(name).split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?'; }
function textElement(tag, text, className) { const element = document.createElement(tag); element.textContent = text; if (className) element.className = className; return element; }

function renderProfiles(users) {
  grid.replaceChildren();
  emptyState.hidden = users.length !== 0;
  users.forEach(user => {
    const personal = user.personal_information || {};
    const education = user.education || {};
    const career = user.career_information || {};
    const card = document.createElement('article'); card.className = 'profile-card';
    card.append(textElement('div', initials(personal.full_name), 'avatar'), textElement('h2', valueOrDash(personal.full_name)), textElement('div', valueOrDash(personal.email), 'email'));
    const meta = document.createElement('div'); meta.className = 'card-meta';
    const role = document.createElement('span'); role.append('↗', textElement('b', valueOrDash(career.target_job_role))); const educationLine = document.createElement('span'); educationLine.append('✦', textElement('b', valueOrDash(education.degree_course || education.highest_education_level))); const date = document.createElement('span'); date.append('◷', textElement('b', dateLabel(user.created_at))); meta.append(role, educationLine, date);
    const view = document.createElement('button'); view.className = 'view-button'; view.type = 'button'; view.textContent = 'View complete profile →'; view.addEventListener('click', () => loadDetails(user.user_id)); card.append(meta, view); grid.appendChild(card);
  });
}

async function loadProfiles() {
  loading.hidden = false; emptyState.hidden = true; grid.replaceChildren(); statusBox.textContent = '';
  try { const response = await fetch(USERS_API_URL, { headers: USER_HEADERS }); const result = await response.json(); if (!response.ok) throw new Error(result.detail || 'Could not load profiles.'); renderProfiles(result.users || []); }
  catch (error) { statusBox.textContent = `${error.message} Make sure FastAPI and MongoDB are running.`; }
  finally { loading.hidden = true; }
}

function addDetailSection(title, rows) { const section = document.createElement('section'); section.className = 'detail-section'; section.appendChild(textElement('h3', title)); const dl = document.createElement('dl'); rows.forEach(([label, value]) => { const row = document.createElement('div'); row.className = 'detail-row'; row.append(textElement('dt', label), textElement('dd', valueOrDash(value))); dl.appendChild(row); }); section.appendChild(dl); detailContent.appendChild(section); }
function addTagSection(title, values) { const section = document.createElement('section'); section.className = 'detail-section'; section.appendChild(textElement('h3', title)); const list = document.createElement('div'); list.className = 'tag-list'; (Array.isArray(values) ? values : []).forEach(value => list.appendChild(textElement('span', value, 'tag'))); if (!list.children.length) list.appendChild(textElement('span', '—', 'tag')); section.appendChild(list); detailContent.appendChild(section); }

async function loadDetails(userId) {
  try { const response = await fetch(`${USERS_API_URL}/${encodeURIComponent(userId)}`, { headers: USER_HEADERS }); const user = await response.json(); if (!response.ok) throw new Error(user.detail || 'Could not load this profile.'); const personal = user.personal_information || {}, education = user.education || {}, career = user.career_information || {}, goals = user.career_goals || {}, resume = user.resume_information || {}; detailTitle.textContent = valueOrDash(personal.full_name); detailContent.replaceChildren(); addDetailSection('Personal information', [['User ID', user.user_id], ['Email', personal.email], ['Preferred name', personal.preferred_name], ['Phone', personal.phone_number], ['City / country', [personal.current_city, personal.country].filter(Boolean).join(', ')] ]); addDetailSection('Education', [['Level', education.highest_education_level], ['Degree / course', education.degree_course], ['Specialization', education.specialization_branch], ['College / university', education.college_university], ['Graduation year', education.graduation_year], ['Status', education.current_education_status]]); addDetailSection('Career', [['Status', career.current_status], ['Target job role', career.target_job_role], ['Industry', career.preferred_industry], ['Work location', career.preferred_work_location], ['Experience', career.experience_level], ['Company', career.current_company], ['Current role', career.current_job_role]]); addTagSection('Programming languages', (user.skills || {}).programming_languages); addTagSection('Technical skills', (user.skills || {}).technical_skills); addTagSection('Tools / technologies', (user.skills || {}).tools_technologies); addTagSection('Soft skills', (user.skills || {}).soft_skills); addDetailSection('Career goals', [['Short-term goal', goals.short_term_career_goal], ['Long-term goal', goals.long_term_career_goal], ['Target role', goals.target_role], ['Target companies', goals.target_companies], ['Improve', goals.areas_to_improve], ['Learning style', Array.isArray(goals.preferred_learning_style) ? goals.preferred_learning_style.join(', ') : goals.preferred_learning_style]]); detailPanel.hidden = false; }
  catch (error) { statusBox.textContent = error.message; }
}

document.getElementById('refreshButton').addEventListener('click', loadProfiles);
document.getElementById('closeDetails').addEventListener('click', () => { detailPanel.hidden = true; });
loadProfiles();

const existingLoadDetails = loadDetails;
loadDetails = async function(userId) {
  await existingLoadDetails(userId);
  try {
    const response = await fetch(`${USERS_API_URL}/${encodeURIComponent(userId)}/resume`, { headers: USER_HEADERS });
    const result = await response.json(); if (!response.ok) throw new Error(result.detail || 'Could not load resume details.');
    const resume = result.resume || {}; const extracted = resume.extracted_information || {};
    const section = document.createElement('section'); section.className = 'detail-section resume-detail';
    section.appendChild(textElement('h3', `Resume v${valueOrDash(resume.version)} · ${valueOrDash(resume.extraction_status)}`));
    const fields = ['education','skills','projects','certifications','internships','work_experience','achievements'];
    const form = document.createElement('div'); form.className = 'resume-edit-grid';
    fields.forEach(field => { const label = document.createElement('label'); label.textContent = field.replaceAll('_', ' '); const input = document.createElement('textarea'); input.dataset.resumeField = field; input.rows = 3; input.value = Array.isArray(extracted[field]) ? extracted[field].join('\n') : ''; label.appendChild(input); form.appendChild(label); });
    const save = document.createElement('button'); save.type = 'button'; save.className = 'view-button'; save.textContent = 'Save corrected resume details';
    const message = document.createElement('p'); message.className = 'resume-edit-message';
    save.addEventListener('click', async () => { save.disabled = true; message.textContent = 'Saving…'; const values = {}; fields.forEach(field => { values[field] = [...form.querySelector(`[data-resume-field="${field}"]`).value.split('\n')].map(item => item.trim()).filter(Boolean); }); try { const saved = await fetch(`${USERS_API_URL}/${encodeURIComponent(userId)}/resume`, { method: 'PUT', headers: { ...USER_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({ extracted_information: values }) }); const body = await saved.json(); if (!saved.ok) throw new Error(body.detail || 'Could not save resume details.'); message.textContent = 'Resume details saved.'; } catch (error) { message.textContent = error.message; } finally { save.disabled = false; } });
    if (Array.isArray(resume.skill_evidence) && resume.skill_evidence.length) {
      const evidence = document.createElement('div'); evidence.className = 'resume-evidence';
      evidence.appendChild(textElement('h4', 'Skills added from completed learning paths'));
      resume.skill_evidence.forEach(item => {
        evidence.appendChild(textElement('p', `${item.skill} · assessment score ${item.assessment_score}% · completed ${dateLabel(item.completion_date)} · assessment ${item.assessment_id}`));
      });
      section.appendChild(evidence);
    }
    section.append(textElement('p', 'This application saves structured resume data and version history. PDF/DOCX generation and download are not currently supported.'), form, save, message); detailContent.appendChild(section);
    const versionsResponse = await fetch(`${USERS_API_URL}/${encodeURIComponent(userId)}/resume/versions`, { headers: USER_HEADERS });
    const versionsResult = await versionsResponse.json(); if (!versionsResponse.ok) throw new Error(versionsResult.detail || 'Could not load resume version history.');
    const versionsSection = document.createElement('section'); versionsSection.className = 'detail-section resume-version-history';
    versionsSection.appendChild(textElement('h3', 'Resume version history'));
    (versionsResult.versions || []).forEach(version => {
      const type = version.version_type === 'learning_path_skill_update' ? 'confirmed learning-path skill update' : version.version_type === 'student_review' ? 'student-reviewed update' : 'uploaded resume';
      const detail = [version.source_assessment_id ? `assessment ${version.source_assessment_id}` : '', version.extraction_status || ''].filter(Boolean).join(' · ');
      versionsSection.appendChild(textElement('p', `Version ${version.version} · ${dateLabel(version.updated_at || version.uploaded_at)} · ${type}${detail ? ` · ${detail}` : ''}`));
    });
    detailContent.appendChild(versionsSection);
  } catch (error) { statusBox.textContent = error.message; }
};
