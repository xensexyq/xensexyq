// Called by actions/github-script. No npm dependencies or personal token needed.
const START = '<!-- PROJECTS:START -->';
const END = '<!-- PROJECTS:END -->';

function cell(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
    .replace(/[&<>|\\`*_[\]]/g, ch => `&#${ch.codePointAt(0)};`);
}

function render(repos, owner) {
  const eligible = repos.filter(repo => !repo.private && !repo.archived
    && repo.owner.login.toLowerCase() === owner.toLowerCase()
    && repo.name.toLowerCase() !== owner.toLowerCase())
    .sort((a, b) => b.created_at.localeCompare(a.created_at)
      || a.name.localeCompare(b.name, 'en'));
  const table = (items) => items.length ? [
    '| Project | Description | Language |',
    '| :--- | :--- | :--- |',
    ...items.map(repo => `| [${cell(repo.name)}](https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}) | ${cell(repo.description) || '暂无描述'} | ${cell(repo.language) || '—'} |`),
  ].join('\n') : '暂无符合条件的公开项目。';
  return [
    '### 🚀 Latest Projects', '',
    '最近创建的公开项目，按创建时间排序，每日自动更新。', '',
    table(eligible.filter(repo => !repo.fork).slice(0, 8)), '',
    '### 🌱 Latest Forks', '',
    '最近 fork 的公开项目；原项目与作者信息见各仓库。', '',
    table(eligible.filter(repo => repo.fork).slice(0, 4)), '',
    `[查看全部仓库](https://github.com/${encodeURIComponent(owner)}?tab=repositories)`,
  ].join('\n');
}

function replaceSection(readme, content) {
  if (readme.split(START).length !== 2 || readme.split(END).length !== 2
      || readme.indexOf(START) >= readme.indexOf(END)) {
    throw new Error('README must contain exactly one ordered PROJECTS marker pair.');
  }
  return readme.slice(0, readme.indexOf(START) + START.length)
    + '\n\n' + content + '\n\n' + readme.slice(readme.indexOf(END));
}

async function update({ github, context, core }) {
  const { owner, repo } = context.repo;
  const branch = context.payload.repository.default_branch;
  // Paginate all public repositories before making any change.
  const repos = await github.paginate(github.rest.repos.listForUser, {
    username: owner, type: 'owner', sort: 'created', direction: 'desc', per_page: 100,
  });
  const { data: file } = await github.rest.repos.getContent({
    owner, repo, path: 'README.md', ref: branch,
  });
  if (file.type !== 'file' || file.encoding !== 'base64') {
    throw new Error('README.md is not a readable base64 file.');
  }
  const previous = Buffer.from(file.content, 'base64').toString('utf8');
  const next = replaceSection(previous, render(repos, owner));
  if (next === previous) {
    core.info('Project list unchanged; no commit needed.');
    return;
  }
  // SHA protects against overwriting a concurrent README edit.
  await github.rest.repos.createOrUpdateFileContents({
    owner, repo, branch, path: 'README.md', sha: file.sha,
    message: 'docs: refresh public projects [skip ci]',
    content: Buffer.from(next, 'utf8').toString('base64'),
  });
  core.info('Updated the project section of README.md.');
}

module.exports = update;
module.exports.render = render;
module.exports.replaceSection = replaceSection;
