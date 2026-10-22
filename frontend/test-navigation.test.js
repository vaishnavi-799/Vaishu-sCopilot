const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { test } = require('node:test');

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this.handlers = {};
    this.options = [];
    this.style = {};
    this.dataset = {};
    this.hidden = false;
    this.checked = false;
    this.disabled = false;
    this.value = '';
    this.textContent = '';
  }

  addEventListener(name, handler) { this.handlers[name] = handler; }
  async click() { return this.handlers.click?.({ currentTarget: this }); }
  async change() { return this.handlers.change?.({ currentTarget: this }); }
  focus() {}
  append(...items) { this.children.push(...items); }
  appendChild(item) { this.children.push(item); return item; }
  replaceChildren(...items) {
    this.children = items;
    if (this.tagName === 'select') this.options = items;
  }
  add(item) { this.options.push(item); }
}

function makeAssessmentResult(testId, selected = 'A') {
  return {
    test_id: testId,
    total_questions: 2,
    correct_count: 2,
    incorrect_count: 0,
    unanswered_count: 0,
    score: '2/2',
    percentage: 100,
    passed: true,
    passing_percentage: 70,
    time_taken_seconds: 12,
    weak_topics: [],
    strong_topics: ['Python'],
    concepts_to_review: [],
    review: [1, 2].map(index => ({
      prompt: `Question ${index}`,
      selected_answer: selected,
      correct_answer: selected,
      is_correct: true,
      options: { A: 'First', B: 'Second', C: 'Third', D: 'Fourth' },
      explanation: 'Sample explanation.',
    })),
    topic_analysis: [{
      topic: 'Python',
      correct_count: 2,
      total_questions: 2,
      percentage: 100,
      level: 'Strong',
    }],
    learning_plan: {
      tasks: [],
      recommended_next_assessment: { topic: 'Python', difficulty: 'Hard', action: 'Continue' },
    },
  };
}

test('assessment back navigation preserves answers and never submits on leave', async () => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, new FakeElement(id === 'testDifficulty' || id === 'testSubject' || id === 'testQuestionCount' || id === 'skillMapRole' ? 'select' : 'div'));
    return elements.get(id);
  };
  element('testDifficulty').options = [{ value: 'Easy' }, { value: 'Medium' }, { value: 'Hard' }];
  element('testDifficulty').value = 'Medium';
  element('testQuestionCount').value = '2';
  element('testTopic').value = 'Python';
  element('testPanel').hidden = true;
  const document = {
    getElementById: element,
    createElement: tagName => new FakeElement(tagName),
    querySelectorAll: () => [],
  };
  const sessionStorage = {
    getItem: key => key === 'vaishu-chat-session' ? 'test-session' : 'test-token',
    setItem() {},
  };
  const localStorage = { getItem: () => null };
  let confirmAnswers = [];
  const window = {
    addEventListener() {},
    vaishuChat: { getHistory: () => [] },
    alert() {},
  };
  const history = { pushState() {}, back() {} };
  let submissionCount = 0;
  const fetch = async url => {
    if (url.endsWith('/generate')) {
      return {
        ok: true,
        async json() {
          return {
            test_id: `test-${submissionCount + 1}`,
            topic: 'Python',
            difficulty: 'Easy',
            source: 'gemini',
            questions: [1, 2].map(index => ({
              question_id: `q${index}`,
              prompt: `Question ${index}`,
              options: { A: 'First', B: 'Second', C: 'Third', D: 'Fourth' },
            })),
          };
        },
      };
    }
    if (url.endsWith('/submit')) {
      submissionCount += 1;
      return { ok: true, json: async () => makeAssessmentResult(`test-${submissionCount}`) };
    }
    return {
      ok: true,
      async json() {
        return {
          overview: { completed_count: submissionCount, passed_count: submissionCount, failed_count: 0 },
          estimate_note: 'Estimate only.',
          skill_gap: { message: 'No role map.' },
          history: [],
          score_trend: [],
          topic_summary: [],
          verified_skills: [],
          profile_skills: [],
          resume_skills: [],
          learning_plan: null,
          learning_plan_progress: null,
          next_action: 'Continue.',
          skill_map: { target_role: 'Software Developer', available_roles: ['Software Developer'], skills: [] },
        };
      },
    };
  };
  const source = fs.readFileSync(path.join(__dirname, 'test.js'), 'utf8');
  vm.runInNewContext(source, {
    document,
    window,
    history,
    sessionStorage,
    localStorage,
    fetch,
    confirm: () => confirmAnswers.shift() ?? true,
    setInterval: () => 1,
    clearInterval() {},
    crypto: { randomUUID: () => 'uuid' },
    URLSearchParams,
    encodeURIComponent,
    Option: class {
      constructor(text, value) { this.text = text; this.value = value; }
    },
  });

  await element('testLaunch').click();
  await element('startTest').click();
  const choose = async (questionIndex, optionIndex) => {
    const radio = element('optionList').children[optionIndex].children[0];
    radio.checked = true;
    await radio.change();
  };
  await choose(0, 0);
  await element('nextQuestion').click();
  await choose(1, 1);
  await element('previousQuestion').click();
  assert.equal(element('optionList').children[0].children[0].checked, true);
  await element('nextQuestion').click();
  assert.equal(element('optionList').children[1].children[0].checked, true);

  confirmAnswers = [false];
  await element('backToChatTaking').click();
  assert.equal(element('testPanel').hidden, false);
  assert.equal(submissionCount, 0);

  confirmAnswers = [true];
  await element('submitTest').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(submissionCount, 1);
  await element('submitTest').click();
  assert.equal(submissionCount, 1);
  await element('viewDashboardFromResults').click();
  assert.equal(element('progressDashboard').hidden, false);
  await element('backToAssessment').click();
  assert.equal(element('resultSummaryContent').hidden, false);
  await element('backToChatResults').click();
  assert.equal(element('testPanel').hidden, true);

  await element('testLaunch').click();
  await element('startTest').click();
  await choose(0, 0);
  confirmAnswers = [true];
  await element('backToChatTaking').click();
  assert.equal(element('testPanel').hidden, true);
  assert.equal(submissionCount, 1);
});
