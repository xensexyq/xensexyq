const test = require('node:test');
const assert = require('node:assert/strict');
const update = require('../scripts/update-projects.cjs');
const { render, replaceSection } = update;
const owner = 'example';
const repo = (name, extra = {}) => ({ name, owner: { login: owner },
  created_at: '2026-01-01T00:00:00Z', private: false, archived: false,
  fork: false, description: null, language: null, ...extra });
const readme = 'INTRO\n<!-- PROJECTS:START -->\nold\n<!-- PROJECTS:END -->\nCONTACT';

test('new projects appear first; private, archived, foreign and profile repos are excluded', () => {
  const result = render([repo('old'), repo('new', { created_at: '2026-09-17T00:00:00Z' }),
    repo('secret', { private: true }), repo('archived', { archived: true }),
    repo('foreign', { owner: { login: 'someone' } }), repo('EXAMPLE')], owner);
  assert.ok(result.indexOf('[new]') < result.indexOf('[old]'));
  for (const name of ['secret', 'archived', 'foreign', 'EXAMPLE']) assert.ok(!result.includes(`[${name}]`));
});
test('separate limits for projects and forks', () => {
  const result = render(Array.from({ length: 12 }, (_, i) => repo(`project${i}`))
    .concat(Array.from({ length: 7 }, (_, i) => repo(`fork${i}`, { fork: true }))), owner);
  assert.equal((result.match(/\| \[project/g) || []).length, 8);
  assert.equal((result.match(/\| \[fork/g) || []).length, 4);
});
test('metadata cannot inject HTML, Markdown images, or extra table rows', () => {
  const result = render([repo('demo', { description: '<img> | ![x](url)\nnext & *bold*' })], owner);
  assert.ok(!result.includes('<img>'));
  assert.ok(!result.includes('![x]'));
  assert.ok(result.includes('&#124;'));
  assert.ok(result.includes('next &#38; &#42;bold&#42;'));
});
test('only marker section changes and reruns are idempotent', () => {
  const next = replaceSection(readme, render([], owner));
  assert.ok(next.startsWith('INTRO\n<!-- PROJECTS:START -->'));
  assert.ok(next.endsWith('<!-- PROJECTS:END -->\nCONTACT'));
  assert.equal(replaceSection(next, render([], owner)), next);
  assert.throws(() => replaceSection('no markers', 'x'));
  assert.throws(() => replaceSection(readme + '<!-- PROJECTS:END -->', 'x'));
  assert.throws(() => replaceSection('<!-- PROJECTS:END --><!-- PROJECTS:START -->', 'x'));
});
function mock(previous, fail = false) {
  const writes = [];
  return { writes, context: { repo: { owner, repo: owner }, payload: { repository: { default_branch: 'main' } } },
    core: { info() {} }, github: { paginate: async () => { if (fail) throw new Error('API unavailable'); return []; },
      rest: { repos: { listForUser() {}, getContent: async () => ({ data: { type: 'file', encoding: 'base64',
        sha: 'current-sha', content: Buffer.from(previous).toString('base64') } }),
      createOrUpdateFileContents: async data => writes.push(data) } } } };
}
test('API writes only README on default branch with concurrency protection', async () => {
  const env = mock(readme); await update(env);
  assert.equal(env.writes.length, 1);
  assert.equal(env.writes[0].path, 'README.md');
  assert.equal(env.writes[0].sha, 'current-sha');
  assert.equal(env.writes[0].branch, 'main');
});
test('unchanged content or failed API never writes', async () => {
  const env = mock(replaceSection(readme, render([], owner))); await update(env);
  assert.equal(env.writes.length, 0);
  const failed = mock(readme, true);
  await assert.rejects(update(failed), /API unavailable/);
  assert.equal(failed.writes.length, 0);
});
