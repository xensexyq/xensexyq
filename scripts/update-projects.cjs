// Called by actions/github-script. No npm dependencies or personal token needed.
const START = '<!-- PROJECTS:START -->';
const END = '<!-- PROJECTS:END -->';
const STACK_START = '<!-- TECH_STACK:START -->';
const STACK_END = '<!-- TECH_STACK:END -->';

const STACK_GROUPS = [
  { icon: '💻', items: [
    { label: 'C++', src: 'https://img.shields.io/badge/C%2B%2B-333333?logo=cplusplus&amp;logoColor=659AD2', signals: ['c++', 'cpp'] },
    { label: 'Python', src: 'https://img.shields.io/badge/Python-333333?logo=python&amp;logoColor=3776AB', signals: ['python'] },
    { label: 'JavaScript', src: 'https://img.shields.io/badge/JavaScript-333333?logo=javascript&amp;logoColor=F7DF1E', signals: ['javascript'] },
    { label: 'TypeScript', src: 'https://img.shields.io/badge/TypeScript-333333?logo=typescript&amp;logoColor=3178C6', signals: ['typescript'] },
    { label: 'Rust', src: 'https://img.shields.io/badge/Rust-333333?logo=rust&amp;logoColor=white', signals: ['rust'] },
    { label: 'Go', src: 'https://img.shields.io/badge/Go-333333?logo=go&amp;logoColor=00ADD8', signals: ['go'] },
    { label: 'Shell', src: 'https://img.shields.io/badge/Shell-333333?logo=gnubash&amp;logoColor=4EAA25', signals: ['shell'] },
    { label: 'PowerShell', src: 'https://img.shields.io/badge/PowerShell-333333?logo=powershell&amp;logoColor=5391FE', signals: ['powershell'] },
  ] },
  { icon: '🤖', items: [
    { label: 'Pinocchio', src: 'https://img.shields.io/badge/Pinocchio-333333', keywords: ['pinocchio'] },
    { label: 'LeRobot', src: 'https://img.shields.io/badge/LeRobot-333333?logo=huggingface&amp;logoColor=FFD21E', keywords: ['lerobot', 'le robot'] },
    { label: 'MeshCat', src: 'https://img.shields.io/badge/MeshCat-333333', keywords: ['meshcat'] },
    { label: 'OpenPI', src: 'https://img.shields.io/badge/OpenPI-333333', keywords: ['openpi', 'open-pi'] },
    { label: 'TacCap', src: 'https://img.shields.io/badge/TacCap-333333', keywords: ['taccap', 'tac-cap'] },
    { label: 'ROS', src: 'https://img.shields.io/badge/ROS-333333?logo=ros&amp;logoColor=22314E', signals: ['ros'], keywords: ['robot operating system'] },
  ] },
  { icon: '🔌', items: [
    { label: 'STM32', src: 'https://img.shields.io/badge/STM32-333333?logo=stmicroelectronics&amp;logoColor=39A9DC', signals: ['stm32'], keywords: ['stm32'] },
    { label: 'CMSIS-DAP', src: 'https://img.shields.io/badge/CMSIS--DAP-333333?logo=arm&amp;logoColor=0091BD', signals: ['cmsis-dap'], keywords: ['cmsis-dap', 'cmsis dap', 'dap-downloader'] },
    { label: 'Arduino', src: 'https://img.shields.io/badge/Arduino-333333?logo=arduino&amp;logoColor=00878F', signals: ['arduino'], keywords: ['arduino'] },
  ] },
  { icon: '⚙️', items: [
    { label: 'CMake', src: 'https://img.shields.io/badge/CMake-333333?logo=cmake&amp;logoColor=64B54E', signals: ['cmake'], keywords: ['cmake'] },
    { label: 'pybind11', src: 'https://img.shields.io/badge/pybind11-333333', signals: ['pybind11'], keywords: ['pybind11'] },
  ] },
  { icon: '🖥', items: [
    { label: 'Qt', src: 'https://img.shields.io/badge/Qt-333333?logo=qt&amp;logoColor=41CD52', signals: ['qt'], keywords: ['pyqt', 'pyside', 'qt5', 'qt6'] },
    { label: 'Windows', src: 'https://img.shields.io/badge/Windows-333333', signals: ['windows'], keywords: ['windows'] },
    { label: 'Linux', src: 'https://img.shields.io/badge/Linux-333333?logo=linux&amp;logoColor=FCC624', signals: ['linux'], keywords: ['linux'] },
  ] },
];

function cell(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
    .replace(/[&<>"'|\\`*_[\]]/g, ch => `&#${ch.codePointAt(0)};`);
}

function eligibleRepos(repos, owner) {
  return repos.filter(repo => !repo.private && !repo.archived
    && repo.owner.login.toLowerCase() === owner.toLowerCase()
    && repo.name.toLowerCase() !== owner.toLowerCase());
}

function render(repos, owner, language = 'en') {
  const en = language === 'en';
  const eligible = eligibleRepos(repos, owner)
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
    `<p align="right"><a href="https://github.com/${encodeURIComponent(owner)}?tab=repositories&amp;type=source">${en ? 'View all projects →' : '查看全部项目 →'}</a></p>`,
  ].join('\n');
}

function renderTechStack(repos, owner, language = 'en', repositoryLanguages = []) {
  const en = language === 'en';
  const sourceRepos = eligibleRepos(repos, owner).filter(repo => !repo.fork);
  const languages = new Map(repositoryLanguages.map(value => [value.toLowerCase(), value]));
  const signals = new Set(languages.keys());
  const searchable = sourceRepos.map(repo => {
    if (repo.language) {
      signals.add(repo.language.toLowerCase());
      languages.set(repo.language.toLowerCase(), repo.language);
    }
    for (const topic of repo.topics || []) signals.add(topic.toLowerCase());
    return [repo.name, repo.description, repo.language, ...(repo.topics || [])]
      .filter(Boolean).join(' ').toLowerCase();
  }).join(' ');
  const rows = STACK_GROUPS.map(group => ({
    icon: group.icon,
    items: group.items.filter(item => (item.signals || []).some(signal => signals.has(signal))
      || (item.keywords || []).some(keyword => searchable.includes(keyword))),
  }));
  const catalogSignals = new Set(STACK_GROUPS.flatMap(group => group.items
    .flatMap(item => item.signals || [])));
  const genericLanguages = [...languages]
    .filter(([key]) => !catalogSignals.has(key))
    .sort(([, a], [, b]) => a.localeCompare(b, 'en'))
    .map(([, label]) => ({
      label: cell(label),
      src: `https://img.shields.io/badge/${encodeURIComponent(label.replace(/-/g, '--').replace(/ /g, '_'))}-333333`,
    }));
  rows[0].items.push(...genericLanguages);
  const populatedRows = rows.filter(group => group.items.length);
  const content = populatedRows.length ? [
    '<p>',
    ...populatedRows.map((group, index) => `  ${group.icon} ${group.items.map(item => `<img src="${item.src}" alt="${item.label}" />`).join(' ')}${index < populatedRows.length - 1 ? '<br />' : ''}`),
    '</p>',
  ] : [`<p><sub>${en ? 'No stack metadata detected yet.' : '暂未检测到技术栈元数据。'}</sub></p>`];
  return [
    en ? '<h3>🛠 Tech Stack</h3>' : '<h3>🛠 技术栈</h3>',
    `<p><sub>${en ? 'Detected from public projects · updated daily' : '基于公开项目自动识别 · 每日更新'}</sub></p>`,
    ...content,
  ].join('\n');
}

function replaceMarkedSection(readme, content, start, end, label) {
  if (readme.split(start).length !== 2 || readme.split(end).length !== 2
      || readme.indexOf(start) >= readme.indexOf(end)) {
    throw new Error(`README must contain exactly one ordered ${label} marker pair.`);
  }
  const eol = readme.includes('\r\n') ? '\r\n' : '\n';
  const normalizedContent = content.replace(/\r?\n/g, eol);
  return readme.slice(0, readme.indexOf(start) + start.length)
    + eol + normalizedContent + eol + readme.slice(readme.indexOf(end));
}

function replaceSection(readme, content) {
  return replaceMarkedSection(readme, content, START, END, 'PROJECTS');
}

function replaceTechStack(readme, content) {
  return replaceMarkedSection(readme, content, STACK_START, STACK_END, 'TECH_STACK');
}

async function update({ github, context, core }) {
  const { owner, repo } = context.repo;
  const branch = context.payload.repository.default_branch;
  // Paginate all public repositories before making any change.
  const repos = await github.paginate(github.rest.repos.listForUser, {
    username: owner, type: 'owner', sort: 'created', direction: 'desc', per_page: 100,
  });
  const repositoryLanguages = new Set();
  await Promise.all(eligibleRepos(repos, owner).filter(repository => !repository.fork)
    .map(async repository => {
      const { data: languages } = await github.rest.repos.listLanguages({
        owner, repo: repository.name,
      });
      for (const language of Object.keys(languages)) repositoryLanguages.add(language);
    }));
  const changes = [];
  for (const [path, language] of [['README.md', 'en'], ['README.en.md', 'en']]) {
    const { data: file } = await github.rest.repos.getContent({ owner, repo, path, ref: branch });
    if (file.type !== 'file' || file.encoding !== 'base64') {
      throw new Error(`${path} is not a readable base64 file.`);
    }
    const previous = Buffer.from(file.content, 'base64').toString('utf8');
    const withProjects = replaceSection(previous, render(repos, owner, language));
    const next = replaceTechStack(withProjects,
      renderTechStack(repos, owner, language, [...repositoryLanguages]));
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
module.exports.renderTechStack = renderTechStack;
module.exports.replaceSection = replaceSection;
module.exports.replaceTechStack = replaceTechStack;
