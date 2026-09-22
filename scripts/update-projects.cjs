// Called by actions/github-script. No npm dependencies or personal token needed.
const START = '<!-- PROJECTS:START -->';
const END = '<!-- PROJECTS:END -->';

function cell(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
    .replace(/[&<>|\\`*_[\]]/g, ch => `&#${ch.codePointAt(0)};`);
}

function render(repos, owner, language = 'en') {
  const en = language === 'en';
  const eligible = repos.filter(repo => !repo.private && !repo.archived
    && repo.owner.login.toLowerCase() === owner.toLowerCase()
    && repo.name.toLowerCase() !== owner.toLowerCase())
    .sort((a, b) => b.created_at.localeCompare(a.created_at)
      || a.name.localeCompare(b.name, 'en'));
  const list = (items) => items.length ? [
    '<ul>',
    ...items.map(repo => {
      const languageLabel = cell(repo.language);
      const description = cell(repo.description);
      return [
        '  <li>',
        `    <a href="https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}"><strong>${cell(repo.name)}</strong></a>${languageLabel ? ` · <code>${languageLabel}</code>` : ''}`,
        ...(description ? [`    <br /><sub>${description}</sub>`] : []),
        '  </li>',
      ].join('\n');
    }),
    '</ul>',
  ].join('\n') : `<p><sub>${en ? 'No matching public repositories yet.' : '暂无符合条件的公开项目。'}</sub></p>`;
  return [
    en ? '<h3>🚀 Latest Projects</h3>' : '<h3>🚀 最新项目</h3>',
    `<p><sub>${en ? 'Newest public repositories · updated daily' : '最新公开项目 · 每日自动更新'}</sub></p>`,
    list(eligible.filter(repo => !repo.fork).slice(0, 4)),
    en ? '<h3>🌱 Latest Forks</h3>' : '<h3>🌱 最近 Fork</h3>',
    `<p><sub>${en ? 'Recent public forks and their upstream projects' : '最近公开 Fork 及其上游项目'}</sub></p>`,
    list(eligible.filter(repo => repo.fork).slice(0, 4)),
    `<p align="right"><a href="https://github.com/${encodeURIComponent(owner)}?tab=repositories">${en ? 'View all repositories →' : '查看全部仓库 →'}</a></p>`,
  ].join('\n');
}

function replaceSection(readme, content) {
  if (readme.split(START).length !== 2 || readme.split(END).length !== 2
      || readme.indexOf(START) >= readme.indexOf(END)) {
    throw new Error('README must contain exactly one ordered PROJECTS marker pair.');
  }
  const eol = readme.includes('\r\n') ? '\r\n' : '\n';
  const normalizedContent = content.replace(/\r?\n/g, eol);
  return readme.slice(0, readme.indexOf(START) + START.length)
    + eol + eol + normalizedContent + eol + eol + readme.slice(readme.indexOf(END));
}

async function update({ github, context, core }) {
  const { owner, repo } = context.repo;
  const branch = context.payload.repository.default_branch;
  // Paginate all public repositories before making any change.
  const repos = await github.paginate(github.rest.repos.listForUser, {
    username: owner, type: 'owner', sort: 'created', direction: 'desc', per_page: 100,
  });
  const changes = [];
  for (const [path, language] of [['README.md', 'en'], ['README.en.md', 'en']]) {
    const { data: file } = await github.rest.repos.getContent({ owner, repo, path, ref: branch });
    if (file.type !== 'file' || file.encoding !== 'base64') {
      throw new Error(`${path} is not a readable base64 file.`);
    }
    const previous = Buffer.from(file.content, 'base64').toString('utf8');
    const next = replaceSection(previous, render(repos, owner, language));
    if (next !== previous) changes.push({ path, sha: file.sha, next });
  }
  // Validate both documents first; each file SHA protects concurrent edits.
  for (const { path, sha, next } of changes) {
    await github.rest.repos.createOrUpdateFileContents({
      owner, repo, branch, path, sha,
      message: `docs: refresh public projects in ${path} [skip ci]`,
      content: Buffer.from(next, 'utf8').toString('base64'),
    });
    core.info(`Updated the project section of ${path}.`);
  }
  if (!changes.length) core.info('Project lists unchanged; no commit needed.');
}

module.exports = update;
module.exports.render = render;
module.exports.replaceSection = replaceSection;
