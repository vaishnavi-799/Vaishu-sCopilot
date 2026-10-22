const TEST_API_URL = '/api/tests';
const testSession = sessionStorage.getItem('vaishu-chat-session') || crypto.randomUUID();
const testSessionToken = sessionStorage.getItem('vaishu-session-token') || '';
sessionStorage.setItem('vaishu-chat-session', testSession);
const testPanel = document.getElementById('testPanel');
const testSetup = document.getElementById('testSetup');
const testTaking = document.getElementById('testTaking');
const testResults = document.getElementById('testResults');
const testError = document.getElementById('testError');
const testTopic = document.getElementById('testTopic');
const testSubject = document.getElementById('testSubject');
const difficulty = document.getElementById('testDifficulty');
const questionCount = document.getElementById('testQuestionCount');
const state = { test: null, answers: {}, current: 0, timer: null, generating: false, submitting: false, submitted: false, dashboardReturnScreen: 'setup', historyEntry: false };
const dismissedSkillPrompts = new Set();
['Beginner', 'Intermediate', 'Advanced'].forEach(level => {
  if (difficulty && ![...difficulty.options].some(option => option.value === level)) {
    difficulty.add(new Option(level, level));
  }
});
const savedDifficulty = localStorage.getItem('vaishu-preferred-difficulty');
if (savedDifficulty && [...difficulty.options].some(option => option.value === savedDifficulty)) difficulty.value = savedDifficulty;

function testHeaders() { return { 'Content-Type': 'application/json', 'X-Chat-Session': testSession, ...(testSessionToken ? { Authorization: `Bearer ${testSessionToken}` } : {}) }; }
function showTestScreen(screen) {
  testSetup.hidden = screen !== 'setup';
  testTaking.hidden = screen !== 'taking';
  testResults.hidden = !['results', 'dashboard'].includes(screen);
  document.getElementById('resultSummaryContent').hidden = screen === 'dashboard';
  document.getElementById('progressDashboard').hidden = screen !== 'dashboard';
}
function openTestPanel() {
  if (testPanel.hidden) {
    testPanel.hidden = false;
    history.pushState({ vaishuAssessment: true }, '', '#assessment');
    state.historyEntry = true;
  }
}
function leaveAssessment() {
  if (!testPanel.hidden && !testTaking.hidden && !state.submitted && Object.keys(state.answers).length) {
    if (!confirm('Leave this assessment? Your answers will be lost and the assessment will not be submitted.')) return;
  }
  state.test = null;
  state.answers = {};
  state.submitted = false;
  state.submitting = false;
  closeTest();
}
function closeTest() {
  clearInterval(state.timer);
  testPanel.hidden = true;
  showTestScreen('setup');
  if (state.historyEntry) {
    state.historyEntry = false;
    history.back();
  }
}
function formatTime(seconds) { const mins = Math.floor(seconds / 60); return `${String(mins).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function setTestError(message) { testError.textContent = message; testError.hidden = !message; }

async function startTest() {
  if (state.generating) return;
  state.generating = true;
  setTestError('');
  const button = document.getElementById('startTest'); button.disabled = true; button.textContent = 'Generating…';
  try {
    const response = await fetch(`${TEST_API_URL}/generate`, { method: 'POST', headers: testHeaders(), body: JSON.stringify({ subject: testSubject?.value || null, topic: testTopic.value.trim() || null, difficulty: difficulty.value, question_count: Number(questionCount.value), question_type: 'mcq', history: window.vaishuChat?.getHistory() || [], use_mock: document.getElementById('useMockQuiz')?.checked || false }) });
    const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.detail || (response.status === 401 ? 'Your session expired. Sign in again to continue.' : response.status === 429 ? 'The assessment service is rate-limited. Please try again later.' : 'The test could not be generated.'));
    state.test = result; state.answers = {}; state.current = 0; state.submitted = false; state.startedAt = Date.now();
    const sampleMode = result.source?.startsWith('mock_');
    document.getElementById('testTitle').textContent = `${sampleMode ? 'Sample quiz · ' : ''}${result.topic} · ${result.difficulty}`;
    document.getElementById('sampleQuizLabel').hidden = !sampleMode;
    showTestScreen('taking'); renderQuestion();
    clearInterval(state.timer); state.timer = setInterval(() => { document.getElementById('testTimer').textContent = formatTime(Math.floor((Date.now() - state.startedAt) / 1000)); }, 1000);
  } catch (error) { setTestError(error instanceof TypeError ? 'Could not reach the assessment service. Check that the FastAPI backend is running.' : error.message); }
  finally { state.generating = false; button.disabled = false; button.textContent = 'Generate test →'; }
}

function renderQuestion() {
  const questions = state.test.questions; const question = questions[state.current];
  document.getElementById('testProgressText').textContent = `Question ${state.current + 1} of ${questions.length}`;
  document.getElementById('answeredText').textContent = `${Object.keys(state.answers).length} answered`;
  document.getElementById('testProgressBar').style.width = `${((state.current + 1) / questions.length) * 100}%`;
  document.getElementById('questionNumber').textContent = `Question ${state.current + 1}`;
  document.getElementById('questionPrompt').textContent = question.prompt;
  const optionList = document.getElementById('optionList'); optionList.replaceChildren();
  Object.entries(question.options).forEach(([key, text]) => {
    const label = document.createElement('label'); label.className = `option-choice${state.answers[question.question_id] === key ? ' selected' : ''}`;
    const input = document.createElement('input'); input.type = 'radio'; input.name = 'answer'; input.value = key; input.checked = state.answers[question.question_id] === key;
    const optionKey = document.createElement('span'); optionKey.className = 'option-key'; optionKey.textContent = `${key}.`;
    const optionText = document.createElement('span'); optionText.className = 'option-text'; optionText.textContent = text;
    input.addEventListener('change', () => { state.answers[question.question_id] = key; renderQuestion(); }); label.append(input, optionKey, optionText); optionList.appendChild(label);
  });
  document.getElementById('previousQuestion').disabled = state.current === 0;
  document.getElementById('nextQuestion').hidden = state.current === questions.length - 1;
  document.getElementById('submitTest').hidden = state.current !== questions.length - 1;
}

async function submitTest() {
  if (state.submitting || state.submitted || !state.test) return;
  if (!confirm('Submit your test now? You will not be able to change your answers afterward.')) return;
  state.submitting = true;
  const submitButton = document.getElementById('submitTest'); submitButton.disabled = true; submitButton.textContent = 'Submitting…';
  try {
    const response = await fetch(`${TEST_API_URL}/submit`, { method: 'POST', headers: testHeaders(), body: JSON.stringify({ test_id: state.test.test_id, answers: state.answers }) });
    const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.detail || (response.status === 401 ? 'Your session expired. Sign in again to continue.' : response.status === 404 ? 'This assessment was not found or is not yours.' : response.status === 409 ? 'This assessment has already been submitted.' : response.status === 422 ? 'The submitted answers are invalid.' : 'The test could not be submitted.'));
    state.submitted = true;
    clearInterval(state.timer); renderResults(result); showTestScreen('results'); loadDashboard();
  } catch (error) { setTestError(error instanceof TypeError ? 'Could not reach the assessment service. Check that the FastAPI backend is running.' : error.message); showTestScreen('taking'); }
  finally { state.submitting = false; submitButton.disabled = false; submitButton.textContent = 'Submit test'; }
}

function renderResults(result) {
  document.getElementById('resultTitle').textContent = result.passed ? 'You passed — nice work!' : 'Not passed yet — use this result to plan your next step.';
  document.getElementById('resultPercentage').textContent = `${result.percentage}%`; document.getElementById('resultScore').textContent = `${result.score} correct`;
  document.getElementById('resultSummary').textContent = `${result.passed ? 'Passed' : 'Not passed'} · ${result.percentage}% (passing score: ${result.passing_percentage}%). Review each answer and explanation below. A short test is only an estimate of your skills.`;
  document.getElementById('passingThreshold').textContent = result.passing_percentage;
  document.getElementById('resultTotal').textContent = result.total_questions ?? result.review.length; document.getElementById('resultCorrect').textContent = result.correct_count; document.getElementById('resultIncorrect').textContent = result.incorrect_count; document.getElementById('resultUnanswered').textContent = result.unanswered_count ?? 0; document.getElementById('resultTime').textContent = formatTime(result.time_taken_seconds);
  const renderTags = (box, values, listId) => { const list = document.getElementById(listId); list.replaceChildren(); values.forEach(value => { const tag = document.createElement('span'); tag.className = 'weak-topic'; tag.textContent = value; list.appendChild(tag); }); box.hidden = values.length === 0; };
  renderTags(document.getElementById('strongTopics'), result.strong_topics || [], 'strongTopicList');
  const weak = document.getElementById('weakTopics'); const weakList = document.getElementById('weakTopicList'); weakList.replaceChildren();
  result.weak_topics.forEach(topic => { const tag = document.createElement('span'); tag.className = 'weak-topic'; tag.textContent = topic; weakList.appendChild(tag); }); weak.hidden = result.weak_topics.length === 0;
  renderTags(document.getElementById('conceptsToReview'), result.concepts_to_review || [], 'conceptsToReviewList');
  const reviewList = document.getElementById('reviewList'); reviewList.replaceChildren();
  result.review.forEach((item, index) => { const card = document.createElement('article'); card.className = `review-item${item.is_correct ? '' : ' incorrect'}`; const title = document.createElement('h4'); title.textContent = `${index + 1}. ${item.prompt}`; const answer = document.createElement('p'); answer.className = item.is_correct ? 'correct-answer' : 'wrong-answer'; const selected = item.selected_answer ? `${item.selected_answer} (${item.options[item.selected_answer]})` : 'Not answered'; answer.textContent = `Your answer: ${selected} · Correct answer: ${item.correct_answer} (${item.options[item.correct_answer]})`; const explanation = document.createElement('p'); explanation.textContent = item.explanation; card.append(title, answer, explanation); reviewList.appendChild(card); });
  document.getElementById('learnWeakTopics').hidden = !(result.concepts_to_review || []).length && !result.weak_topics.length;
  const planBox = document.getElementById('assessmentPlan'); const planContent = document.getElementById('assessmentPlanContent'); planContent.replaceChildren();
  if (result.learning_plan) { const plan = result.learning_plan; (plan.tasks || []).forEach((task, index) => { const label = document.createElement('label'); label.className = 'plan-task'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = Boolean(task.completed); checkbox.addEventListener('change', () => updatePlanTask(index, checkbox)); const text = document.createElement('span'); text.textContent = `${task.topic}: ${task.task} (${task.estimated_minutes} min)`; label.append(checkbox, text); planContent.appendChild(label); }); const next = document.createElement('p'); next.textContent = `Next assessment: ${plan.recommended_next_assessment.topic} · ${plan.recommended_next_assessment.difficulty}`; planContent.appendChild(next); planBox.hidden = false; } else planBox.hidden = true;
  const verifiedBox = document.getElementById('verifiedSkills'); const verifiedContent = document.getElementById('verifiedSkillContent'); verifiedContent.replaceChildren();
  if (result.verified_skill) { verifiedContent.textContent = `${result.verified_skill.skill} · ${result.verified_skill.level} · ${result.verified_skill.score}%`; verifiedBox.hidden = false; } else verifiedBox.hidden = true;
  const analysisBox = document.getElementById('skillAnalysis'); const analysisContent = document.getElementById('topicAnalysisContent'); analysisContent.replaceChildren();
  document.getElementById('levelRulesNote').textContent = result.estimate_note || 'Skill bands are product estimates, not a complete measure of ability.';
  (result.topic_analysis || []).forEach(topic => { const item = document.createElement('div'); item.className = 'topic-analysis-item'; const heading = document.createElement('div'); heading.className = 'topic-analysis-heading'; const name = document.createElement('strong'); name.textContent = topic.topic; const level = document.createElement('span'); level.textContent = topic.level || 'Not enough data'; heading.append(name, level); const bar = document.createElement('div'); bar.className = 'topic-bar'; const fill = document.createElement('span'); fill.style.width = `${topic.percentage}%`; bar.appendChild(fill); const detail = document.createElement('small'); detail.textContent = `${topic.correct_count}/${topic.total_questions} correct · ${topic.percentage}%${topic.level ? ` · ${topic.level} estimate` : ' · more questions needed for an estimate'}`; item.append(heading, bar, detail); analysisContent.appendChild(item); }); analysisBox.hidden = !(result.topic_analysis || []).length;
  state.lastResult = result;
}

document.getElementById('testLaunch').addEventListener('click', () => { openTestPanel(); showTestScreen('setup'); testTopic.focus(); });
document.getElementById('viewDashboard').addEventListener('click', () => { state.dashboardReturnScreen = 'setup'; openTestPanel(); showTestScreen('dashboard'); loadDashboard(); });
document.getElementById('viewDashboardFromResults').addEventListener('click', () => { state.dashboardReturnScreen = 'results'; showTestScreen('dashboard'); loadDashboard(); });
document.getElementById('backToAssessment').addEventListener('click', () => { showTestScreen(state.dashboardReturnScreen || 'setup'); });
document.getElementById('backToChatSetup').addEventListener('click', leaveAssessment);
document.getElementById('backToChatTaking').addEventListener('click', leaveAssessment);
document.getElementById('backToChatResults').addEventListener('click', leaveAssessment);
document.getElementById('backToChatDashboard').addEventListener('click', leaveAssessment);
document.getElementById('testClose').addEventListener('click', leaveAssessment);
window.addEventListener('popstate', () => {
  if (testPanel.hidden) return;
  state.historyEntry = false;
  leaveAssessment();
  if (!testPanel.hidden) {
    history.pushState({ vaishuAssessment: true }, '', '#assessment');
    state.historyEntry = true;
  }
});
window.addEventListener('beforeunload', event => {
  if (!testPanel.hidden && !testTaking.hidden && !state.submitted && Object.keys(state.answers).length) {
    event.preventDefault();
    event.returnValue = '';
  }
});
document.getElementById('startTest').addEventListener('click', startTest);
document.getElementById('previousQuestion').addEventListener('click', () => { state.current -= 1; renderQuestion(); });
document.getElementById('nextQuestion').addEventListener('click', () => { state.current += 1; renderQuestion(); });
document.getElementById('submitTest').addEventListener('click', submitTest);
document.getElementById('retakeTest').addEventListener('click', () => { state.test = null; state.answers = {}; state.submitted = false; showTestScreen('setup'); testError.hidden = true; });
document.getElementById('learnWeakTopics').addEventListener('click', () => { const concepts = state.lastResult.concepts_to_review?.join(', ') || state.lastResult.weak_topics.join(', '); closeTest(); window.vaishuChat?.sendMessage(`Please teach me these concepts from my assessment in a simple way: ${concepts}. Give me a short explanation, one example, and one practice question.`); });

async function updatePlanTask(index, checkbox) {
  const desiredValue = checkbox.checked;
  checkbox.disabled = true;
  try {
    const response = await fetch(`${TEST_API_URL}/learning-plan`, {
      method: 'PUT',
      headers: testHeaders(),
      body: JSON.stringify({ task_index: index, completed: desiredValue }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || 'Could not save task progress.');
    if (state.lastResult?.learning_plan?.tasks[index]) state.lastResult.learning_plan.tasks[index].completed = desiredValue;
    await loadDashboard();
  } catch (error) {
    checkbox.checked = !desiredValue;
    setDashboardError(error.message);
  } finally {
    checkbox.disabled = false;
  }
}

function setDashboardError(message) {
  const error = document.getElementById('dashboardError');
  error.textContent = message;
  error.hidden = !message;
}

function renderPlanTasks(container, plan) {
  container.replaceChildren();
  if (!plan) {
    container.textContent = 'No learning plan yet. Complete an assessment to get a personalized next step.';
    return;
  }
  (plan.tasks || []).forEach((task, index) => {
    const label = document.createElement('label');
    label.className = 'plan-task';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(task.completed);
    checkbox.addEventListener('change', () => updatePlanTask(index, checkbox));
    const text = document.createElement('span');
    text.textContent = `${task.topic}: ${task.task} (${task.estimated_minutes} min)`;
    label.append(checkbox, text);
    container.appendChild(label);
  });
  const next = plan.recommended_next_assessment;
  if (next) {
    const recommendation = document.createElement('p');
    recommendation.textContent = `Next assessment: ${next.topic} · ${next.difficulty}. ${next.action}`;
    container.appendChild(recommendation);
    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'secondary-test-button';
    start.textContent = 'Start recommended assessment →';
    start.addEventListener('click', () => {
      testTopic.value = next.topic;
      if ([...difficulty.options].some(option => option.value === next.difficulty)) difficulty.value = next.difficulty;
      setTestError('');
      showTestScreen('setup');
      testTopic.focus();
    });
    container.appendChild(start);
  }
  if (!plan.tasks?.length) {
    const passed = document.createElement('p');
    passed.textContent = 'No revision tasks are currently needed; continue with the recommended next assessment.';
    container.appendChild(passed);
  }
}

function updateTopicTask(skill, topic, taskId, checkbox) {
  const completed = checkbox.checked;
  checkbox.disabled = true;
  fetch(`${TEST_API_URL}/topic-progress`, {
    method: 'PUT',
    headers: testHeaders(),
    body: JSON.stringify({ skill, topic, task_id: taskId, completed }),
  }).then(async response => {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || 'Could not save topic progress.');
    await loadDashboard();
  }).catch(error => {
    checkbox.checked = !completed;
    setDashboardError(error.message);
  }).finally(() => { checkbox.disabled = false; });
}

async function commitQualifiedSkill(skill) {
  const userId = localStorage.getItem('vaishu-user-id');
  if (!userId) {
    setDashboardError('Your student profile is unavailable. Sign in again before updating your resume.');
    return;
  }
  const response = await fetch(`/api/users/${encodeURIComponent(userId)}/resume/qualified-skill?${new URLSearchParams({ skill })}`, {
    method: 'POST',
    headers: testHeaders(),
    body: JSON.stringify({ confirmed: true }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.detail || 'Could not save the confirmed resume update.');
  window.alert(`${result.message}\n\n${result.capability_note || 'The structured resume profile is updated.'}`);
  await loadDashboard();
}

function renderSkillQualifications(qualifications) {
  const panel = document.getElementById('skillQualificationPanel');
  const content = document.getElementById('skillQualificationContent');
  content.replaceChildren();
  const eligible = (qualifications || []).filter(item => item.eligible_for_resume && !item.already_in_resume && !dismissedSkillPrompts.has(item.skill));
  panel.hidden = !eligible.length;
  eligible.forEach(item => {
    const card = document.createElement('article');
    card.className = 'qualification-card';
    const heading = document.createElement('strong');
    heading.textContent = `Congratulations! You completed the ${item.skill} learning path and passed its assessment. ${item.skill} is eligible to be added to your resume.`;
    const evidence = document.createElement('p');
    evidence.textContent = `Assessment score: ${item.assessment_score}% · Evidence: ${item.assessment_id}. The original uploaded file will not be overwritten; this updates a versioned structured resume profile.`;
    const actions = document.createElement('div');
    actions.className = 'qualification-actions';
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'primary-test-button';
    add.textContent = 'Add to resume';
    add.addEventListener('click', async () => {
      if (!confirm(`Add ${item.skill} to your structured resume profile? A new version will be saved; your original uploaded file will remain unchanged.`)) return;
      add.disabled = true;
      try { await commitQualifiedSkill(item.skill); }
      catch (error) { setDashboardError(error.message); }
      finally { add.disabled = false; }
    });
    const review = document.createElement('button');
    review.type = 'button';
    review.className = 'secondary-test-button';
    review.textContent = 'Review update';
    const notNow = document.createElement('button');
    notNow.type = 'button';
    notNow.className = 'secondary-test-button';
    notNow.textContent = 'Not now';
    const preview = document.createElement('div');
    preview.className = 'resume-update-preview';
    preview.hidden = true;
    review.addEventListener('click', () => {
      preview.replaceChildren();
      const summary = document.createElement('p');
      summary.textContent = `Proposed change: add “${item.skill}” to the skills section. Existing education, work experience, projects, certifications, and skills will be preserved. Source assessment ${item.assessment_id}, score ${item.assessment_score}%. This updates structured resume data only; no PDF/DOCX file is generated.`;
      const confirmUpdate = document.createElement('button');
      confirmUpdate.type = 'button';
      confirmUpdate.className = 'primary-test-button';
      confirmUpdate.textContent = 'Confirm and add';
      confirmUpdate.addEventListener('click', async () => {
        confirmUpdate.disabled = true;
        try { await commitQualifiedSkill(item.skill); }
        catch (error) { setDashboardError(error.message); }
        finally { confirmUpdate.disabled = false; }
      });
      preview.append(summary, confirmUpdate);
      preview.hidden = false;
    });
    notNow.addEventListener('click', () => {
      dismissedSkillPrompts.add(item.skill);
      card.remove();
      if (!content.children.length) panel.hidden = true;
    });
    actions.append(add, review, notNow);
    card.append(heading, evidence, actions, preview);
    content.appendChild(card);
  });
}

function renderSkillMap(skillMap) {
  const roleSelect = document.getElementById('skillMapRole');
  const availableRoles = skillMap?.available_roles || [];
  const selectedRole = skillMap?.target_role || 'Software Developer';
  const existingRoles = [...roleSelect.options].map(option => option.value);
  if (existingRoles.join('|') !== availableRoles.join('|')) {
    roleSelect.replaceChildren(...availableRoles.map(role => new Option(role, role)));
  }
  roleSelect.value = selectedRole;
  const container = document.getElementById('skillMapContent');
  container.replaceChildren();
  (skillMap?.skills || []).forEach(skill => {
    const card = document.createElement('details');
    card.className = 'skill-path-card';
    const summary = document.createElement('summary');
    const label = document.createElement('span');
    label.textContent = skill.skill;
    const status = document.createElement('strong');
    status.textContent = skill.verified ? 'Verified' : skill.assessment_status === 'passed' ? 'Passed assessment' : skill.assessment_status === 'needs_improvement' ? 'Needs improvement' : skill.status === 'in_progress' ? 'In progress' : 'Not assessed';
    summary.append(label, status);
    card.appendChild(summary);
    const assessment = document.createElement('p');
    assessment.textContent = skill.assessment_status === 'not_assessed'
      ? 'Skill assessment: Not assessed'
      : `Skill assessment: ${skill.assessment_status === 'passed' ? 'Passed' : 'Needs improvement'} · ${skill.assessment_score}%`;
    card.appendChild(assessment);
    (skill.topics || []).forEach(topic => {
      const topicCard = document.createElement('div');
      topicCard.className = 'topic-progress-card';
      const topicHeader = document.createElement('div');
      topicHeader.className = 'topic-analysis-heading';
      const topicName = document.createElement('strong');
      topicName.textContent = topic.topic;
      const topicStatus = document.createElement('span');
      topicStatus.textContent = topic.status === 'completed' ? 'Completed' : topic.status === 'in_progress' ? 'In progress' : 'Not started';
      topicHeader.append(topicName, topicStatus);
      const assessmentStatus = document.createElement('small');
      assessmentStatus.textContent = topic.assessment_status === 'not_assessed'
        ? 'Assessment: Not assessed'
        : `Assessment: ${topic.assessment_status === 'passed' ? 'Passed' : 'Needs improvement'} · ${topic.assessment_score}%`;
      topicCard.append(topicHeader, assessmentStatus);
      (topic.tasks || []).forEach(task => {
        const label = document.createElement('label');
        label.className = 'plan-task';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => updateTopicTask(skill.skill, topic.topic, task.task_id, checkbox));
        const text = document.createElement('span');
        text.textContent = task.description;
        label.append(checkbox, text);
        topicCard.appendChild(label);
      });
      card.appendChild(topicCard);
    });
    if (skill.eligible_for_resume && skill.already_in_resume) {
      const existing = document.createElement('p');
      existing.textContent = 'Eligible learning evidence is already listed in the structured resume.';
      card.appendChild(existing);
    }
    container.appendChild(card);
  });
  if (!skillMap?.skills?.length) container.textContent = 'No skill paths are configured for this role.';
}

async function loadDashboard() {
  const panel = document.getElementById('progressDashboard');
  setDashboardError('');
  try {
    const response = await fetch(`${TEST_API_URL}/dashboard`, { headers: testHeaders() });
    const dashboard = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(dashboard.detail || 'The progress dashboard could not be loaded.');
    const overview = dashboard.overview || {};
    const cards = document.getElementById('dashboardCards'); cards.replaceChildren();
    const topicName = topic => topic ? `${topic.topic} · ${topic.percentage}%` : 'Not assessed';
    [['Latest score', overview.latest_percentage == null ? 'Not assessed' : `${overview.latest_percentage}%`], ['Average score', overview.average_percentage == null ? 'Not assessed' : `${overview.average_percentage}%`], ['Assessments', overview.completed_count ?? 0], ['Passed', overview.passed_count ?? 0], ['Failed', overview.failed_count ?? 0], ['Strongest topic', topicName(dashboard.strongest_topic)], ['Topic to improve', topicName(dashboard.weakest_topic)]].forEach(([label, value]) => { const card = document.createElement('div'); card.className = 'dashboard-card'; const valueNode = document.createElement('strong'); valueNode.textContent = value; const labelNode = document.createElement('span'); labelNode.textContent = label; card.append(valueNode, labelNode); cards.appendChild(card); });
    document.getElementById('dashboardNote').textContent = dashboard.estimate_note || '';
    const gaps = document.getElementById('skillGapContent'); gaps.replaceChildren(); const gap = dashboard.skill_gap || {};
    const role = document.createElement('p'); role.textContent = gap.target_role ? `Target role: ${gap.target_role}` : 'No target role is configured; showing general skill development.';
    const required = document.createElement('p'); required.textContent = gap.required_skills?.length ? `Role skills: ${gap.required_skills.join(', ')}` : gap.message || 'No mapped role skills are available.';
    const notAssessed = document.createElement('p'); notAssessed.textContent = gap.not_assessed?.length ? `Not yet assessed: ${gap.not_assessed.join(', ')}` : 'All mapped role skills have assessment history.';
    const improve = document.createElement('p'); improve.textContent = gap.assessed_needing_improvement?.length ? `Assessed and needs improvement: ${gap.assessed_needing_improvement.join(', ')}` : 'No mapped role skill is currently below the passing score.';
    const goals = document.createElement('p'); goals.textContent = gap.learning_goals?.length ? `Your learning goals: ${gap.learning_goals.join(' · ')}` : 'No learning goals are listed in your profile.';
    gaps.append(role, required, notAssessed, improve, goals);
    const topics = document.getElementById('topicSummaryContent'); topics.replaceChildren();
    (dashboard.topic_summary || []).forEach(topic => {
      const item = document.createElement('div'); item.className = 'topic-analysis-item';
      const heading = document.createElement('div'); heading.className = 'topic-analysis-heading';
      const name = document.createElement('strong'); name.textContent = topic.topic;
      const level = document.createElement('span'); level.textContent = topic.level || 'Not enough data';
      const bar = document.createElement('div'); bar.className = 'topic-bar';
      const fill = document.createElement('span'); fill.style.width = `${topic.percentage ?? 0}%`; bar.appendChild(fill);
      const detail = document.createElement('small'); detail.textContent = `${topic.correct_count}/${topic.total_questions} correct across ${topic.assessment_count} assessment(s) · ${topic.percentage ?? 0}%${topic.level ? ` · ${topic.level} estimate` : ' · more questions needed'}`;
      item.append(heading, bar, detail); heading.append(name, level); topics.appendChild(item);
    });
    if (!dashboard.topic_summary?.length) topics.textContent = 'No assessed topics yet.';
    const verified = document.getElementById('verifiedSkillDashboard'); verified.replaceChildren();
    (dashboard.verified_skills || []).forEach(skill => { const item = document.createElement('p'); item.textContent = `${skill.skill} · ${skill.score}% assessment score · ${skill.level} difficulty`; verified.appendChild(item); });
    if (!dashboard.verified_skills?.length) verified.textContent = 'No skills verified by a passed assessment yet. Profile and resume skills are not treated as verified.';
    document.getElementById('profileSkillContent').textContent = dashboard.profile_skills?.length ? dashboard.profile_skills.join(', ') : 'No skills listed in your profile.';
    document.getElementById('resumeSkillContent').textContent = dashboard.resume_skills?.length ? dashboard.resume_skills.join(', ') : 'No skills extracted from your resume.';
    renderSkillMap(dashboard.skill_map);
    renderSkillQualifications(dashboard.skill_map?.skills || []);
    const trend = document.getElementById('scoreTrend'); trend.replaceChildren();
    const scores = dashboard.score_trend || [];
    scores.forEach(item => {
      const entry = document.createElement('div'); entry.className = 'trend-item';
      const bar = document.createElement('div'); bar.className = 'trend-bar'; bar.style.height = `${Math.max(4, Math.min(100, Number(item.percentage) || 0))}%`; bar.title = `${item.topic}: ${item.percentage}%`;
      const score = document.createElement('small'); score.textContent = `${item.percentage}%`;
      const label = document.createElement('span'); label.textContent = item.topic;
      entry.append(bar, score, label); trend.appendChild(entry);
    });
    document.getElementById('trendNote').textContent = scores.length > 1 ? 'Scores shown in submission order, using saved assessment history.' : scores.length === 1 ? 'One saved attempt so far; a trend will appear after another assessment.' : 'No score history yet.';
    const history = document.getElementById('historyContent'); history.replaceChildren(); (dashboard.history || []).slice(0, 5).forEach(item => { const row = document.createElement('p'); row.textContent = `${item.topic} · ${item.percentage}% · ${item.passed ? 'Passed' : 'Not passed'}`; history.appendChild(row); }); if (!dashboard.history?.length) history.textContent = 'No completed assessments yet.';
    const progress = dashboard.learning_plan_progress;
    document.getElementById('learningPlanProgress').textContent = progress ? progress.total_tasks ? `${progress.completed_tasks} of ${progress.total_tasks} tasks complete · ${progress.percentage}%` : 'No revision tasks in the current plan.' : 'No active learning plan yet.';
    renderPlanTasks(document.getElementById('dashboardPlanContent'), dashboard.learning_plan);
    document.getElementById('dashboardNextAction').textContent = `Next action: ${dashboard.next_action}`;
    panel.hidden = false;
  } catch (error) { setDashboardError(error instanceof TypeError ? 'Could not reach the progress dashboard.' : error.message); panel.hidden = false; }
}

document.getElementById('refreshDashboard').addEventListener('click', loadDashboard);
document.getElementById('skillMapRole').addEventListener('change', async event => {
  setDashboardError('');
  const select = event.currentTarget;
  select.disabled = true;
  try {
    const response = await fetch(`${TEST_API_URL}/skill-map`, {
      method: 'PUT',
      headers: testHeaders(),
      body: JSON.stringify({ target_role: select.value }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || 'Could not update the target role.');
    await loadDashboard();
  } catch (error) {
    setDashboardError(error.message);
  } finally {
    select.disabled = false;
  }
});
