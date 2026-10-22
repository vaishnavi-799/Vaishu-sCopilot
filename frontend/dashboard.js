const API_BASE_URL = '';
const api = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: { ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    const target = `${window.location.pathname.split('/').pop()}${window.location.search}`;
    window.location.href = `login.html?next=${encodeURIComponent(target)}`;
    throw new Error('Your session expired. Please sign in to continue.');
  }
  if (!response.ok) throw new Error(body.detail || `Request failed (${response.status}).`);
  return body;
};
const content = document.getElementById('dashboardContent');
const statusBox = document.getElementById('dashboardStatus');
const page = document.body.dataset.page;
let activeProfile;
const esc = value => String(value ?? '—');
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function section(title) {
  const element = node('section', undefined, 'student-section');
  element.appendChild(node('h2', title));
  content.appendChild(element);
  return element;
}
function row(parent, title, detail) {
  const element = node('div', undefined, 'student-row');
  element.append(node('strong', title), node('p', detail, 'student-muted'));
  parent.appendChild(element);
  return element;
}
function cards(metrics) {
  const grid = node('div', undefined, 'student-grid');
  metrics.forEach(([label, value]) => {
    const card = node('article', undefined, 'student-card');
    card.append(node('strong', value), node('span', label));
    grid.appendChild(card);
  });
  content.appendChild(grid);
}
function dateLabel(value) {
  if (!value) return 'Date not supplied';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleString();
}
async function loadHome() {
  const dashboard = await api('/api/tests/dashboard');
  const overview = dashboard.overview || {};
  cards([
    ['Latest score', overview.latest_percentage == null ? 'Not assessed' : `${overview.latest_percentage}%`],
    ['Historical average', overview.average_percentage == null ? 'Not assessed' : `${overview.average_percentage}%`],
    ['Assessments', overview.completed_count ?? 0],
    ['Passed', overview.passed_count ?? 0],
    ['Failed', overview.failed_count ?? 0],
  ]);
  const next = section('Recommended next action');
  next.appendChild(node('p', dashboard.next_action || 'Take an assessment to establish a baseline.'));
  row(next, 'Strongest topic', dashboard.strongest_topic ? `${dashboard.strongest_topic.topic}: ${dashboard.strongest_topic.percentage}% (${dashboard.strongest_topic.correct_count}/${dashboard.strongest_topic.total_questions})` : 'Not enough assessment data.');
  row(next, 'Topic to improve', dashboard.weakest_topic ? `${dashboard.weakest_topic.topic}: ${dashboard.weakest_topic.percentage}% (${dashboard.weakest_topic.correct_count}/${dashboard.weakest_topic.total_questions})` : 'Not enough assessment data.');
  const trend = section('Recent score trend');
  (dashboard.score_trend || []).forEach(attempt => {
    const item = row(trend, `${attempt.topic}: ${attempt.percentage}%`, `${attempt.passed ? 'Passed' : 'Needs review'} · ${dateLabel(attempt.submitted_at)}`);
    const meter = node('div', undefined, 'student-meter');
    const fill = node('span');
    fill.style.width = `${Math.max(0, Math.min(100, Number(attempt.percentage) || 0))}%`;
    meter.appendChild(fill);
    item.appendChild(meter);
  });
  if (!dashboard.score_trend?.length) trend.appendChild(node('p', 'No assessment history yet.'));
  const progress = dashboard.learning_plan_progress;
  row(section('Learning plan'), 'Persisted task progress', progress ? `${progress.completed_tasks}/${progress.total_tasks} tasks · ${progress.percentage}%` : 'No saved learning plan yet.');
}
async function loadSkills() {
  const [map, dashboard, verifiedResult, historyResult, session] = await Promise.all([
    api('/api/tests/skill-map'), api('/api/tests/dashboard'), api('/api/tests/skills'), api('/api/tests/history'), api('/api/auth/session'),
  ]);
  const profile = session.profile || {};
  const selfReported = Object.values(profile.skills || {}).flat().filter(Boolean);
  const resumeSkills = profile.resume_information?.extracted_information?.skills || [];
  cards([
    ['Target role', map.target_role || 'General development'],
    ['Self-reported skills', selfReported.length],
    ['Resume-extracted skills', resumeSkills.length],
    ['Verified skills', (verifiedResult.skills || []).length],
  ]);
  const areas = section('Skills by evidence');
  row(areas, 'Self-reported', selfReported.join(', ') || 'No profile skills recorded.');
  row(areas, 'Resume extracted', resumeSkills.join(', ') || 'No skills were extracted from the uploaded resume.');
  row(areas, 'Assessed topics', (dashboard.topic_summary || []).map(topic => topic.topic).join(', ') || 'No assessment history.');
  row(areas, 'Verified by passed assessment', (verifiedResult.skills || []).map(item => item.skill).join(', ') || 'No verified skills.');
  const paths = section(`${map.target_role || 'Selected role'} learning map`);
  (map.skills || []).forEach(skill => {
    const card = node('article', undefined, 'skill-card');
    card.append(node('h3', `${skill.skill} · ${skill.status.replaceAll('_', ' ')}`));
    card.append(node('p', skill.assessment_score == null ? `Assessment: ${skill.assessment_status.replaceAll('_', ' ')}` : `Assessment: ${skill.assessment_score}% · ${skill.assessment_status}`));
    (skill.topics || []).forEach(topic => row(card, `${topic.topic} · ${topic.status.replaceAll('_', ' ')}`, topic.assessment_score == null ? `Assessment: ${topic.assessment_status.replaceAll('_', ' ')}` : `Assessment: ${topic.assessment_score}%`));
    paths.appendChild(card);
  });
  row(section('Recent assessment attempts'), 'Saved records', `${(historyResult.tests || []).length} most recent attempt(s) loaded.`);
}
async function loadPerformance() {
  const [dashboard, history] = await Promise.all([api('/api/tests/dashboard'), api('/api/tests/history')]);
  const overview = dashboard.overview || {};
  cards([
    ['Latest score', overview.latest_percentage == null ? 'Not assessed' : `${overview.latest_percentage}%`],
    ['Historical average', overview.average_percentage == null ? 'Not assessed' : `${overview.average_percentage}%`],
    ['Attempts', overview.completed_count ?? 0],
    ['Passed', overview.passed_count ?? 0],
    ['Failed', overview.failed_count ?? 0],
  ]);
  const topics = section('Topic performance (actual question totals)');
  (dashboard.topic_summary || []).forEach(topic => {
    const item = row(topics, `${topic.topic} · ${topic.level || 'Not enough data'}`, `${topic.correct_count}/${topic.total_questions} correct across ${topic.assessment_count} attempt(s)${topic.percentage == null ? '' : ` · ${topic.percentage}%`}`);
    if (topic.percentage != null) {
      const meter = node('div', undefined, 'student-meter'); const fill = node('span');
      fill.style.width = `${Math.max(0, Math.min(100, topic.percentage))}%`; meter.appendChild(fill); item.appendChild(meter);
    }
  });
  if (!dashboard.topic_summary?.length) topics.appendChild(node('p', 'No topic results yet.'));
  const attempts = section('Assessment history');
  (history.tests || []).forEach(test => row(attempts, `${test.topic || 'Assessment'} · ${test.percentage ?? 'No score'}% · ${test.passed ? 'Passed' : 'Not passed'}`, `${test.score || ''} · ${test.difficulty || 'Difficulty not recorded'} · ${dateLabel(test.submitted_at || test.created_at)}`));
  if (!history.tests?.length) attempts.appendChild(node('p', 'No completed assessments yet.'));
  const recommendation = dashboard.learning_plan?.recommended_next_assessment;
  row(section('Recommended next assessment'), recommendation ? recommendation.action : 'No saved recommendation yet.', recommendation ? `${recommendation.topic} · ${recommendation.difficulty}` : 'Complete an assessment to receive a next step.');
}
async function loadJobs() {
  const [preferencesResult, result] = await Promise.all([api('/api/jobs/preferences'), api('/api/jobs/recommendations')]);
  const preferences = preferencesResult.preferences || {};
  const form = node('form', undefined, 'student-form');
  const role = document.createElement('input'); role.name = 'target_role'; role.placeholder = 'Target role'; role.value = preferences.target_role || '';
  const location = document.createElement('input'); location.name = 'location'; location.placeholder = 'Preferred location'; location.value = preferences.location || '';
  const remote = document.createElement('input'); remote.type = 'checkbox'; remote.name = 'remote'; remote.checked = Boolean(preferences.remote); remote.setAttribute('aria-label', 'Prefer remote work');
  const remoteLabel = node('label', 'Prefer remote jobs'); remoteLabel.prepend(remote);
  const save = node('button', 'Save preferences', 'student-button'); save.type = 'submit';
  form.append(role, location, remoteLabel, save); content.appendChild(form);
  form.addEventListener('submit', async event => {
    event.preventDefault(); save.disabled = true;
    try {
      await api('/api/jobs/preferences', { method: 'PUT', body: JSON.stringify({ target_role: role.value, location: location.value, remote: remote.checked }) });
      content.replaceChildren(); await loadJobs();
    } catch (error) { statusBox.textContent = error.message; } finally { save.disabled = false; }
  });
  const action = node('button', 'Check for today’s listings', 'student-button secondary');
  action.type = 'button';
  action.addEventListener('click', async () => {
    action.disabled = true;
    try { content.replaceChildren(); const refreshed = await api('/api/jobs/refresh', { method: 'POST' }); renderJobs(refreshed); }
    catch (error) { statusBox.textContent = error.message; }
  });
  content.appendChild(action);
  renderJobs(result);
}
function renderJobs(result) {
  const listingSection = section('Current provider listings');
  listingSection.appendChild(node('p', result.message || (result.cached ? 'Showing cached results for today.' : 'Results checked for today.'), 'student-muted'));
  if (result.target_role) listingSection.appendChild(node('p', `Search: ${result.target_role}${result.location ? ` · ${result.location}` : ''}${result.based_on?.length ? ` · Skills and gaps considered: ${result.based_on.join(', ')}` : ''}`));
  if (result.last_checked_at) listingSection.appendChild(node('p', `Last checked: ${dateLabel(result.last_checked_at)}`));
  if (!result.jobs?.length) {
    listingSection.appendChild(node('p', result.configured ? 'No suitable live jobs were returned by the provider.' : 'No job listings are shown until a provider is configured. No sample jobs are substituted.'));
    return;
  }
  result.jobs.slice(0, 10).forEach(job => {
    const card = node('article', undefined, 'job-card');
    card.append(node('h3', job.title), node('p', `${job.company} · ${job.location}`));
    card.append(node('p', 'Work mode: Not supplied by provider'));
    card.append(node('p', `Experience: ${job.experience_level || 'Not supplied by provider'}`));
    card.append(node('p', job.required_skills ? `Required skills: ${job.required_skills.join(', ')}` : 'Structured required skills were not supplied by the provider; no match is inferred.'));
    card.append(node('p', `Posted: ${dateLabel(job.posted_at)} · Source: ${job.source || result.provider || 'Unknown'}`));
    if (job.application_url && /^https:\/\/[a-z0-9.-]+\//i.test(job.application_url)) {
      const link = node('a', 'Apply on provider site', 'student-link');
      link.href = job.application_url; link.target = '_blank'; link.rel = 'noopener noreferrer'; card.appendChild(link);
    }
    listingSection.appendChild(card);
  });
}
async function loadResume() {
  const session = await api('/api/auth/session');
  activeProfile = session.profile;
  const userId = encodeURIComponent(session.user_id);
  const [resumeResult, versionsResult, skillMap] = await Promise.all([
    api(`/api/users/${userId}/resume`), api(`/api/users/${userId}/resume/versions`), api('/api/tests/skill-map'),
  ]);
  const resume = resumeResult.resume || {};
  cards([
    ['Latest structured version', resume.version == null ? 'None' : `v${resume.version}`],
    ['Original file', resume.original_filename || 'No uploaded file'],
    ['Extraction', resume.extraction_status || 'Not available'],
  ]);
  const details = section('Latest structured resume');
  const extracted = resume.extracted_information || {};
  Object.entries(extracted).forEach(([name, values]) => row(details, name.replaceAll('_', ' '), Array.isArray(values) && values.length ? values.join(', ') : 'No saved entries.'));
  details.appendChild(node('p', 'Updated structured data and version history are supported. PDF/DOCX generation and download are not currently supported.'));
  const uploadLink = node('a', 'Upload or replace resume', 'student-link'); uploadLink.href = 'index.html'; details.appendChild(uploadLink);
  row(section('Verified skills versus resume skills'), 'Assessment evidence', (resume.skill_evidence || []).map(item => `${item.skill}: ${item.assessment_score}% · ${item.assessment_id}`).join('; ') || 'No qualifying learning-path additions saved.');
  const versions = section('Version history');
  (versionsResult.versions || []).forEach(item => row(versions, `Version ${item.version} · ${item.version_type || 'Uploaded resume'}`, dateLabel(item.updated_at || item.uploaded_at)));
  if (!versionsResult.versions?.length) versions.appendChild(node('p', 'No uploaded resume versions.'));
  const eligible = (skillMap.skills || []).filter(item => item.eligible_for_resume && !item.already_in_resume);
  if (eligible.length) {
    const pending = section('Verified skill updates awaiting your confirmation');
    eligible.forEach(item => {
      const card = node('article', undefined, 'skill-card');
      card.append(node('h3', `${item.skill} is eligible for a structured resume update`));
      card.append(node('p', `Evidence: assessment ${item.assessment_id}, ${item.assessment_score}%. Required learning topics are complete. This does not claim professional experience.`));
      const confirm = node('button', 'Review and add to resume', 'student-button');
      confirm.addEventListener('click', async () => {
        if (!window.confirm(`Create a new structured resume version adding ${item.skill}? Your uploaded original and prior versions will be preserved.`)) return;
        confirm.disabled = true;
        try {
          await api(`/api/users/${userId}/resume/qualified-skill?${new URLSearchParams({ skill: item.skill })}`, { method: 'POST', body: JSON.stringify({ confirmed: true }) });
          content.replaceChildren(); await loadResume();
        } catch (error) { statusBox.textContent = error.message; } finally { confirm.disabled = false; }
      });
      card.appendChild(confirm); pending.appendChild(card);
    });
  }
}
async function loadLearning() {
  const [map, planResult, calendar] = await Promise.all([api('/api/tests/skill-map'), api('/api/tests/learning-plan'), api('/api/learning/calendar')]);
  const schedule = section('Learning calendar');
  const preferences = calendar.preferences || {};
  const form = node('form', undefined, 'student-form');
  const minutes = document.createElement('input'); minutes.type = 'number'; minutes.name = 'weekly_minutes'; minutes.min = '30'; minutes.max = '3000'; minutes.step = '30'; minutes.required = true; minutes.value = preferences.weekly_minutes || 300; minutes.setAttribute('aria-label', 'Available study minutes per week');
  const start = document.createElement('input'); start.type = 'date'; start.name = 'start_date'; start.required = true; start.min = new Date().toISOString().slice(0, 10); start.value = preferences.start_date || start.min; start.setAttribute('aria-label', 'Learning schedule start date');
  const saveSchedule = node('button', calendar.configured ? 'Update schedule' : 'Create study schedule', 'student-button'); saveSchedule.type = 'submit';
  form.append(node('label', 'Available minutes per week'), minutes, node('label', 'Start date'), start, saveSchedule);
  form.addEventListener('submit', async event => {
    event.preventDefault(); saveSchedule.disabled = true;
    try {
      await api('/api/learning/calendar', { method: 'PUT', body: JSON.stringify({ weekly_minutes: Number(minutes.value), start_date: start.value }) });
      content.replaceChildren(); await loadLearning();
    } catch (error) { statusBox.textContent = error.message; } finally { saveSchedule.disabled = false; }
  });
  schedule.appendChild(form);
  schedule.appendChild(node('p', 'The schedule uses your selected weekly study time and actual saved revision/topic tasks. It does not represent estimated mastery.'));
  if (!calendar.configured) schedule.appendChild(node('p', 'Set your study time to create a dated schedule from your current learning tasks.'));
  else if (!calendar.tasks?.length) schedule.appendChild(node('p', 'No incomplete learning tasks are available to schedule.'));
  (calendar.tasks || []).forEach(task => {
    const entry = row(schedule, `${task.title} · ${task.status}`, `Scheduled ${task.scheduled_date}${task.source === 'topic' ? ` · ${task.skill} / ${task.topic}` : ' · assessment revision'}`);
    const controls = node('div', undefined, 'student-form');
    const done = document.createElement('input'); done.type = 'checkbox'; done.checked = Boolean(task.completed); done.disabled = Boolean(task.stale); done.setAttribute('aria-label', `Complete ${task.title}`);
    done.addEventListener('change', async () => {
      done.disabled = true;
      try {
        if (task.source === 'topic') {
          await api('/api/tests/topic-progress', { method: 'PUT', body: JSON.stringify({ skill: task.skill, topic: task.topic, task_id: task.topic_task_id, completed: done.checked }) });
        } else {
          await api('/api/tests/learning-plan', { method: 'PUT', body: JSON.stringify({ task_index: task.task_index, completed: done.checked }) });
        }
        content.replaceChildren(); await loadLearning();
      } catch (error) { done.checked = !done.checked; statusBox.textContent = error.message; }
    });
    const date = document.createElement('input'); date.type = 'date'; date.min = new Date().toISOString().slice(0, 10); date.value = task.scheduled_date; date.setAttribute('aria-label', `Reschedule ${task.title}`);
    const reschedule = node('button', 'Reschedule', 'student-button secondary'); reschedule.disabled = Boolean(task.stale);
    reschedule.addEventListener('click', async () => {
      reschedule.disabled = true;
      try {
        await api('/api/learning/calendar/task', { method: 'PUT', body: JSON.stringify({ task_id: task.task_id, scheduled_date: date.value }) });
        content.replaceChildren(); await loadLearning();
      } catch (error) { statusBox.textContent = error.message; } finally { reschedule.disabled = false; }
    });
    controls.append(done, date, reschedule); entry.appendChild(controls);
  });
  const pathSection = section('Learning roadmap');
  (map.skills || []).forEach(skill => {
    const card = node('article', undefined, 'skill-card');
    card.append(node('h3', skill.skill), node('p', `Skill status: ${skill.status.replaceAll('_', ' ')}`));
    (skill.topics || []).forEach(topic => {
      const topicTitle = node('h4', `${topic.topic} · ${topic.status.replaceAll('_', ' ')}`);
      card.appendChild(topicTitle);
      if (topic.assessment_score != null) card.appendChild(node('p', `Latest topic assessment: ${topic.assessment_score}% · ${topic.assessment_status}`));
      const list = node('ol', undefined, 'skill-topics');
      (topic.tasks || []).forEach(task => {
        const li = node('li', undefined, 'skill-task');
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = Boolean(task.completed);
        checkbox.addEventListener('change', async () => {
          checkbox.disabled = true;
          try {
            await api('/api/tests/topic-progress', { method: 'PUT', body: JSON.stringify({ skill: skill.skill, topic: topic.topic, task_id: task.task_id, completed: checkbox.checked }) });
            content.replaceChildren(); await loadLearning();
          } catch (error) { checkbox.checked = !checkbox.checked; statusBox.textContent = error.message; }
          finally { checkbox.disabled = false; }
        });
        li.append(checkbox, document.createTextNode(task.description)); list.appendChild(li);
      });
      card.appendChild(list);
    });
    pathSection.appendChild(card);
  });
  const plan = planResult.learning_plan;
  const planSection = section('Assessment revision plan');
  if (!plan?.tasks?.length) {
    planSection.appendChild(node('p', 'No saved revision tasks yet. Submit an assessment to get evidence-based next steps.'));
  } else {
    plan.tasks.forEach((task, index) => {
      const label = node('label', undefined, 'student-row');
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = Boolean(task.completed);
      checkbox.addEventListener('change', async () => {
        checkbox.disabled = true;
        try {
          await api('/api/tests/learning-plan', { method: 'PUT', body: JSON.stringify({ task_index: index, completed: checkbox.checked }) });
          content.replaceChildren(); await loadLearning();
        } catch (error) { checkbox.checked = !checkbox.checked; statusBox.textContent = error.message; }
      });
      label.append(checkbox, document.createTextNode(` ${task.title || task.topic || 'Learning task'}`));
      planSection.appendChild(label);
    });
  }
}
async function loadProfile() {
  const session = await api('/api/auth/session');
  const profile = session.profile || {};
  const personal = profile.personal_information || {};
  const education = profile.education || {};
  const career = profile.career_information || {};
  cards([['Student', personal.preferred_name || personal.full_name || 'Student'], ['Email', personal.email || 'Not available'], ['Target role', profile.career_goals?.target_role || career.target_job_role || 'Not set']]);
  const sectionNode = section('Saved profile');
  row(sectionNode, 'Education', [education.degree_course, education.college_university, education.graduation_year].filter(Boolean).join(' · ') || 'No education details.');
  row(sectionNode, 'Preferred location', career.preferred_work_location || 'Not set');
  row(sectionNode, 'Experience level', career.experience_level || 'Not set');
  row(sectionNode, 'Resume', profile.resume_information?.uploaded ? `Version ${profile.resume_information.version} · ${profile.resume_information.extraction_status}` : 'No resume uploaded.');
  const editLink = node('a', 'Edit profile or upload a resume', 'student-link'); editLink.href = 'index.html'; sectionNode.appendChild(editLink);
  const button = node('button', 'Sign out', 'student-button'); button.addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); }
    finally { localStorage.removeItem('vaishu-user-id'); sessionStorage.removeItem('vaishu-session-token'); window.location.href = 'login.html'; }
  });
  sectionNode.appendChild(button);
}
async function initDashboard() {
  document.querySelectorAll('.student-nav a').forEach(link => {
    if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
  });
  try {
    await api('/api/auth/session');
    const loaders = { home: loadHome, skills: loadSkills, performance: loadPerformance, jobs: loadJobs, resume: loadResume, learning: loadLearning, profile: loadProfile };
    await loaders[page]();
  } catch (error) { statusBox.textContent = error.message; }
}
document.getElementById('signOutButton')?.addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); }
  finally { localStorage.removeItem('vaishu-user-id'); sessionStorage.removeItem('vaishu-session-token'); window.location.href = 'login.html'; }
});
initDashboard();
