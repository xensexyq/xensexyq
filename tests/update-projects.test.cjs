const test = require('node:test');
const assert = require('node:assert/strict');
const update = require('../scripts/update-projects.cjs');
const { render, renderTechStack, replaceSection, replaceTechStack } = update;
const owner = 'example';
const repo = (name, extra = {}) => ({ name, owner: { login: owner },
  created_at: '2026-01-01T00:00:00Z', private: false, archived: false,
  fork: false, description: null, language: null, ...extra });
const readme = 'INTRO\n<!-- PROJECTS:START -->\nold\n<!-- PROJECTS:END -->\nCONTACT';
const document = 'INTRO\n<!-- ABOUT:START -->\nold intro\n<!-- ABOUT:END -->\n'
  + '<!-- PORTFOLIO:START -->\nold portfolio\n<!-- PORTFOLIO:END -->\n<!-- TECH_STACK:START -->\nold stack\n<!-- TECH_STACK:END -->\n'
  + '<!-- PROJECTS:START -->\nold projects\n<!-- PROJECTS:END -->\nCONTACT';

test('new projects appear first; private, archived, foreign and profile repos are excluded', () => {
  const result = render([repo('old'), repo('new', { created_at: '2026-09-17T00:00:00Z' }),
    repo('secret', { private: true }), repo('archived', { archived: true }),
    repo('foreign', { owner: { login: 'someone' } }), repo('EXAMPLE')], owner);
  assert.ok(result.indexOf('<strong>new</strong>') < result.indexOf('<strong>old</strong>'));
  for (const name of ['secret', 'archived', 'foreign', 'EXAMPLE']) {
    assert.ok(!result.includes(`<strong>${name}</strong>`));
  }
});
test('only original projects are shown and the compact list is limited', () => {
  const result = render(Array.from({ length: 12 }, (_, i) => repo(`project${i}`))
    .concat(Array.from({ length: 7 }, (_, i) => repo(`fork${i}`, { fork: true }))), owner);
  assert.equal((result.match(/<strong>project/g) || []).length, 3);
  assert.equal((result.match(/<strong>fork/g) || []).length, 0);
  assert.ok(!result.includes('Latest Forks'));
  assert.ok(!result.includes('<ul>'));
  assert.ok(result.includes('daily ·'));
  assert.equal((result.match(/<p>/g) || []).length, 3);
});
test('metadata cannot inject HTML, Markdown images, or extra list items', () => {
  const result = render([repo('demo', { description: '<img> | ![x](url)\nnext & *bold*' })], owner);
  assert.ok(!result.includes('<img>'));
  assert.ok(!result.includes('![x]'));
  assert.ok(result.includes('&#124;'));
  assert.ok(result.includes('next &#38; &#42;bold&#42;'));
});
test('repository descriptions flow directly into the generated project list', () => {
  const first = render([repo('demo', { description: 'First description' })], owner);
  const second = render([repo('demo', { description: 'Updated description' })], owner);
  assert.ok(first.includes('title="First description"'));
  assert.ok(second.includes('title="Updated description"'));
  assert.notEqual(first, second);
});
test('tech stack is detected from source repository languages, topics and descriptions', () => {
  const result = renderTechStack([
    repo('robot-app', { language: 'Python', topics: ['qt'],
      description: 'Pinocchio control on Windows with STM32 and CMSIS-DAP' }),
    repo('forked', { fork: true, language: 'Rust', topics: ['lerobot'] }),
    repo('secret', { private: true, language: 'Go' }),
  ], owner, 'en', ['CMake', 'Shell', 'Zig'], ['MeshCat pybind11 git clone Linux with PySide6']);
  for (const label of ['Python', 'Shell', 'Zig', 'Pinocchio', 'LeRobot', 'MeshCat',
    'STM32', 'CMSIS-DAP', 'CMake', 'pybind11', 'Git', 'Qt', 'Windows', 'Linux']) {
    assert.ok(result.includes(`alt="${label}"`));
  }
  for (const label of ['Rust', 'Go']) assert.ok(!result.includes(`alt="${label}"`));
  const changed = renderTechStack([repo('rewritten', { language: 'Rust' })], owner);
  assert.ok(changed.includes('alt="Rust"'));
  assert.ok(!changed.includes('alt="Python"'));
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
test('replacement stays contiguous inside an HTML table cell', () => {
  const html = `<table>\n<td>\n${readme}\n</td>\n</table>`;
  const next = replaceSection(html, '<h3>Projects</h3>');
  assert.ok(next.includes('<td>\nINTRO\n<!-- PROJECTS:START -->\n<h3>Projects</h3>\n<!-- PROJECTS:END -->\nCONTACT\n</td>'));
});
test('the existing README line ending style is preserved', () => {
  const crlfReadme = readme.replace(/\n/g, '\r\n');
  const next = replaceSection(crlfReadme, 'line one\nline two');
  assert.ok(next.includes('line one\r\nline two'));
  assert.equal(next.replace(/\r\n/g, '').includes('\n'), false);
});
function mock(previous, fail = false, repos = [], languageData = {}, readmeData = {}) {
  const writes = [];
  return { writes, context: { repo: { owner, repo: owner }, payload: { repository: { default_branch: 'main' } } },
    core: { info() {} }, github: { paginate: async () => { if (fail) throw new Error('API unavailable'); return repos; },
      rest: { repos: { listForUser() {}, getContent: async ({ path }) => ({ data: { type: 'file', encoding: 'base64',
        sha: 'current-sha', content: Buffer.from(typeof previous === 'string' ? previous : previous[path]).toString('base64') } }),
      listLanguages: async ({ repo: name }) => ({ data: languageData[name] || {} }),
      getReadme: async ({ repo: name }) => ({ data: { encoding: 'base64',
        content: Buffer.from(readmeData[name] || '').toString('base64') } }),
      createOrUpdateFileContents: async data => writes.push(data) } } } };
}
test('API updates all language files on the default branch with concurrency protection', async () => {
  const env = mock(document); await update(env);
  assert.equal(env.writes.length, 3);
  assert.equal(env.writes[0].path, 'README.md');
  assert.equal(env.writes[0].sha, 'current-sha');
  assert.equal(env.writes[0].branch, 'main');
  assert.equal(env.writes[1].path, 'README.en.md');
  assert.ok(Buffer.from(env.writes[1].content, 'base64').toString('utf8').includes('All →'));
});
test('API language inventories and README metadata feed the generated tech stack', async () => {
  const env = mock(document, false, [repo('demo', { language: 'Python' })],
    { demo: { Python: 1200, CMake: 300 } }, { demo: 'MeshCat with pybind11 on Linux' });
  await update(env);
  const content = Buffer.from(env.writes[0].content, 'base64').toString('utf8');
  assert.ok(content.includes('alt="Python"'));
  assert.ok(content.includes('alt="CMake"'));
  assert.ok(content.includes('alt="MeshCat"'));
  assert.ok(content.includes('alt="pybind11"'));
  assert.ok(content.includes('alt="Linux"'));
});
test('unchanged content or failed API never writes', async () => {
  const current = language => update.renderProfile(document, [], owner, language);
  const env = mock({ 'README.md': current('en'), 'README.en.md': current('en'), 'README.zh-CN.md': current('zh') }); await update(env);
  assert.equal(env.writes.length, 0);
  const failed = mock(document, true);
  await assert.rejects(update(failed), /API unavailable/);
  assert.equal(failed.writes.length, 0);
});
test('English labels are translated while repository descriptions remain verbatim', () => {
  const result = render([repo('described', { description: '中文项目' }), repo('empty')], owner, 'en');
  assert.ok(result.includes('中文项目'));
  assert.ok(result.includes('Latest Projects'));
  assert.ok(!result.includes('暂无描述'));
});
test('invalid English markers prevent all writes', async () => {
  const env = mock({ 'README.md': document, 'README.en.md': 'missing markers', 'README.zh-CN.md': document });
  await assert.rejects(update(env), /marker pair/);
  assert.equal(env.writes.length, 0);
});
test('missing tech stack markers prevent all writes', async () => {
  const env = mock({ 'README.md': document, 'README.en.md': document.replace('<!-- TECH_STACK:END -->', ''), 'README.zh-CN.md': document });
  await assert.rejects(update(env), /TECH_STACK marker pair/);
  assert.equal(env.writes.length, 0);
});


test('new public projects refresh the introduction and full portfolio, preserving personal text', async () => {
  const previous = document.replace('old intro', 'stale introduction')
    .replace('old portfolio', 'stale portfolio') + '\nPERSONAL CONTACT';
  const env = mock(previous, false, [
    repo('arm-sim', { description: 'Pinocchio robot arm simulation' }),
    repo('camera-workbench', { description: 'ROS 2 visual SLAM with Gemini cameras' }),
    repo('secret', { private: true, description: 'Private medical project' }),
    repo('fork', { fork: true }), repo('archived', { archived: true }),
  ]);
  await update(env);
  const text = Buffer.from(env.writes[0].content, 'base64').toString('utf8');
  assert.ok(!text.includes('stale introduction'));
  assert.ok(!text.includes('stale portfolio'));
  assert.match(text, /Robot control and simulation/);
  assert.match(text, /Vision and state estimation/);
  assert.match(text, /camera-workbench/);
  assert.match(text, /ROS 2 visual SLAM with Gemini cameras/);
  for (const name of ['secret', 'medical', '>fork<', '>archived<']) assert.ok(!text.includes(name));
  assert.ok(text.startsWith('INTRO'));
  assert.ok(text.endsWith('PERSONAL CONTACT'));
});


test('new domains and unclassified projects enter the overview without claiming README references as expertise', () => {
  const before = update.renderProfile(document, [repo('flasher', { description: 'STM32 firmware tools' })], owner);
  const after = update.renderProfile(document, [
    repo('flasher', { description: 'STM32 firmware tools' }),
    repo('new-tool', { description: 'A completely new domain' }),
    repo('vision', { topics: ['visual-inertial-odometry'] }),
  ], owner, 'en', [], ['An unrelated README mentions medical diagnosis.']);
  assert.notEqual(before, after);
  assert.match(after, /Embedded systems and device interfaces/);
  assert.match(after, /Vision and state estimation/);
  assert.match(after, /Other tools and resources/);
  assert.match(after, /A completely new domain/);
  assert.ok(!after.includes('medical'));
});

test('Chinese overview is regenerated and descriptions are escaped, including unclassified projects', async () => {
  const env = mock(document, false, [repo('new-tool', { description: '<script>alert(1)</script> | [link](x)' })]);
  await update(env);
  const zh = env.writes.find(write => write.path === 'README.zh-CN.md');
  assert.ok(zh);
  const text = Buffer.from(zh.content, 'base64').toString('utf8');
  assert.match(text, /其他工具与资料/);
  assert.ok(text.includes('&#60;script&#62;'));
  assert.ok(!text.includes('<script>'));
  assert.match(text, /最新项目/);
});

test('all four sections are idempotent and malformed overview markers prevent every write', async () => {
  const repos = [repo('a', { description: 'STM32 firmware' }), repo('b', { description: 'VIO calibration' })];
  const current = {};
  for (const [file, lang] of [['README.md', 'en'], ['README.en.md', 'en'], ['README.zh-CN.md', 'zh']]) {
    current[file] = update.renderProfile(document, repos, owner, lang);
  }
  const same = mock(current, false, repos);
  await update(same);
  assert.equal(same.writes.length, 0);
  const bad = mock({ ...current, 'README.zh-CN.md': current['README.zh-CN.md'].replace('<!-- ABOUT:END -->', '') }, false, repos);
  await assert.rejects(update(bad), /ABOUT/);
  assert.equal(bad.writes.length, 0);
});

test('removing or privatizing a project removes it from the introduction and portfolio', () => {
  const initial = update.renderProfile(document, [repo('camera', { description: 'SLAM' })], owner);
  const next = update.renderProfile(initial, [repo('camera', { description: 'SLAM', private: true })], owner);
  assert.ok(!next.includes('camera'));
  assert.ok(!next.includes('Vision and state estimation'));
});

test('control simulation repositories are classified even when the description is empty', () => {
  const rendered = update.renderProfile(document, [repo('fastiter-control-sim')], owner);
  assert.match(rendered, /Robot control and simulation/);
  assert.ok(!rendered.includes('Other tools and resources'));
});

test('About Me summarizes experience without project links, names or repository counts', () => {
  const output = update.renderProfile(document, [repo('unique-device-tool', {description:'STM32 firmware'})], owner);
  const about = output.split('<!-- ABOUT:START -->')[1].split('<!-- ABOUT:END -->')[0];
  assert.ok(!about.includes('<a '));
  assert.ok(!about.includes('unique-device-tool'));
  assert.ok(!/\d+ public project/.test(about));
  assert.match(about, /firmware|device/i);
  const mixed = update.renderProfile(document, [repo('robot', {description:'robot kinematics'}), repo('deploy', {description:'CLI setup utility'})], owner);
  const focused = mixed.split('<!-- ABOUT:START -->')[1].split('<!-- ABOUT:END -->')[0];
  assert.match(focused, /Robotics:/);
  assert.ok(!focused.includes('recurring setup'));
  assert.match(mixed, /Other tools and resources/);
  const zh = update.renderProfile(document,[repo('unique-device-tool',{description:'STM32 firmware'})],owner,'zh')
    .split('<!-- ABOUT:START -->')[1].split('<!-- ABOUT:END -->')[0];
  assert.ok(!zh.includes('<a '));
  assert.match(zh,/固件|设备/);
});

test('badge groups use bounded nonwrapping rows with a consistent image height', () => {
  const result = renderTechStack([], owner, 'en', ['C++','Python','Shell','PowerShell','Batchfile','CSS','Dockerfile']);
  assert.ok(result.includes('<pre>'));
  assert.ok(!result.includes('<table'));
  const rows = result.split('<pre>')[1].split('</pre>')[0].trim().split('\n');
  assert.ok(rows.length >= 2);
  for (const row of rows) {
    const badges = row.match(/<img /g) || [];
    assert.ok(badges.length > 0 && badges.length <= 4);
    assert.equal((row.match(/height="20"/g)||[]).length,badges.length);
  }
});

test('recent projects use the column width for visible descriptions without a nested table', () => {
  const result=render([repo('one',{language:'Python',description:'Camera calibration and sensor capture.'}),repo('two',{language:'C++'}),repo('three')],owner);
  assert.equal((result.match(/<p>/g)||[]).length,3);
  assert.ok(!result.includes('<table'));
  assert.match(result, /<br \/>Camera calibration and sensor capture\./);
  assert.match(result, /<code>Python<\/code>/);
});
