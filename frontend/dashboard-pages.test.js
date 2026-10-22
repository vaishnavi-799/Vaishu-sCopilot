const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const pages = {
  'dashboard.html': 'home',
  'skills.html': 'skills',
  'performance.html': 'performance',
  'jobs.html': 'jobs',
  'resume.html': 'resume',
  'learning.html': 'learning',
  'profile.html': 'profile',
};

test('each dashboard destination is a separate authenticated page with shared navigation', () => {
  for (const [filename, key] of Object.entries(pages)) {
    const html = fs.readFileSync(path.join(root, filename), 'utf8');
    assert.match(html, new RegExp(`<body[^>]*data-page="${key}"`), `${filename} has its own page identity`);
    assert.match(html, /dashboard\.js/, `${filename} loads the authenticated page controller`);
    assert.match(html, /id="dashboardContent"/, `${filename} has a data-driven page region`);
    for (const destination of Object.keys(pages)) {
      assert.match(html, new RegExp(`href="${destination.replace('.', '\\.')}"`), `${filename} links to ${destination}`);
      assert.ok(fs.existsSync(path.join(root, destination)), `${destination} exists`);
    }
  }
});
