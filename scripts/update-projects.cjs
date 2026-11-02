// Called by actions/github-script. No npm dependencies or personal token needed.
const START = '<!-- PROJECTS:START -->';
const END = '<!-- PROJECTS:END -->';
const STACK_START = '<!-- TECH_STACK:START -->';
const STACK_END = '<!-- TECH_STACK:END -->';

// Classify repository metadata, not arbitrary technologies cited in a README.
// Unknown domains still appear in the count and complete project catalog.
const FOCUS_AREAS = [
  { en: 'Robot control and simulation', zh: '机器人控制与仿真',
    pattern: /\b(robot|robotics|pinocchio|meshcat|kinematics|control[-_]sim|lerobot|gripper|taccap|fr3)\b|机械臂|机器人|夹爪/i },
  { en: 'Embedded systems and device interfaces', zh: '嵌入式与设备接口',
    pattern: /\b(stm32\w*|cmsis[- ]dap|firmware|modbus|rs485|embedded)\b|嵌入式|固件|传感器/i },
  { en: 'Vision and state estimation', zh: '视觉与状态估计',
    pattern: /\b(vio|slam|vslam|okvis\w*|visual[- ]inertial|camera\w*|gemini|nvblox)\b|视觉|相机|建图/i },
  { en: 'Other tools and resources', zh: '其他工具与资料' },
];

function publicProjects(repos, owner) {
  return eligibleRepos(repos, owner).filter(repo => !repo.fork)
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

function focusFor(repo) {
  const metadata = [repo.name, repo.description, ...(repo.topics || [])].filter(Boolean).join(' ');
  return FOCUS_AREAS.find(area => area.pattern?.test(metadata)) || FOCUS_AREAS.at(-1);
}

function projectLink(repo, owner) {
  return `<a href="https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}">${cell(repo.name)}</a>`;
}

function renderAbout(repos, owner, language = 'en') {
  const projects = publicProjects(repos, owner);
  const en = language === 'en';
  const lines = [en
    ? `<p>My ${projects.length} public project${projects.length === 1 ? ' covers' : 's cover'} the following areas, from hardware interfaces to simulation and perception tooling.</p>`
    : `<p>我的 ${projects.length} 个公开项目涵盖以下方向，连接硬件接口、仿真与感知工具。</p>`];
  const areas = FOCUS_AREAS.map(area => ({ area, projects: projects.filter(repo => focusFor(repo) === area) }))
    .filter(group => group.projects.length);
  if (areas.length) {
    lines.push('<ul>', ...areas.map(group =>
      `  <li><strong>${en ? group.area.en : group.area.zh}</strong> · ${group.projects.length} — ${group.projects.slice(0, 2).map(repo => projectLink(repo, owner)).join(', ')}</li>`), '</ul>');
  } else {
    lines.push(en ? '<p>Public project details will appear here as repositories are added.</p>'
      : '<p>新增公开仓库后，这里会自动显示项目方向。</p>');
  }
  return lines.join('\n');
}

function renderPortfolio(repos, owner, language = 'en') {
  const en = language === 'en';
  const projects = publicProjects(repos, owner);
  if (!projects.length) return en ? '<p>No public projects to list yet.</p>' : '<p>暂无可展示的公开项目。</p>';
  return [
    '<table>',
    en ? '<thead><tr><th>Project</th><th>Focus / description</th></tr></thead>'
      : '<thead><tr><th>项目</th><th>方向 / 简介</th></tr></thead>',
    '<tbody>',
    ...projects.map(repo => {
      const area = focusFor(repo);
      const description = cell(repo.description);
      return `<tr><td>${projectLink(repo, owner)}</td><td><strong>${en ? area.en : area.zh}</strong>${description ? `<br />${description}` : ''}</td></tr>`;
    }),
    '</tbody>', '</table>',
  ].join('\n');
}

function renderProfile(previous, repos, owner, language = 'en', languages = [], texts = []) {
  let next = replaceMarkedSection(previous, renderAbout(repos, owner, language),
    '<!-- ABOUT:START -->', '<!-- ABOUT:END -->', 'ABOUT');
  next = replaceMarkedSection(next, renderPortfolio(repos, owner, language),
    '<!-- PORTFOLIO:START -->', '<!-- PORTFOLIO:END -->', 'PORTFOLIO');
  next = replaceSection(next, render(repos, owner, language));
  return replaceTechStack(next, renderTechStack(repos, owner, language, languages, texts));
}

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
    { label: 'Git', src: 'https://img.shields.io/badge/Git-333333?logo=git&amp;logoColor=F05032', signals: ['git'], keywords: ['git clone'] },
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
  const list = (items) => {
    if (!items.length) {
      return `<p><sub>${en ? 'No matching public repositories yet.' : '暂无符合条件的公开项目。'}</sub></p>`;
    }
    const projects = items.map(repo => {
      const languageLabel = cell(repo.language);
      const description = cell(repo.description);
      return `&bull; <a href="https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}"${description ? ` title="${description}"` : ''}><strong>${cell(repo.name)}</strong></a>${languageLabel ? ` · <code>${languageLabel}</code>` : ''}`;
    });
    const rows = projects.map((project, index) =>
      `  ${project}${index < projects.length - 1 ? '<br />' : ''}`);
    return ['<p>', ...rows, '</p>'].join('\n');
  };
  const allProjects = `https://github.com/${encodeURIComponent(owner)}?tab=repositories&amp;type=source`;
  return [
    en
      ? `<h3>🚀 Latest Projects <sub>daily · <a href="${allProjects}">All →</a></sub></h3>`
      : `<h3>🚀 最新项目 <sub>每日更新 · <a href="${allProjects}">全部 →</a></sub></h3>`,
    list(eligible.filter(repo => !repo.fork).slice(0, 3)),
  ].join('\n');
}

function renderTechStack(repos, owner, language = 'en', repositoryLanguages = [], repositoryTexts = []) {
  const en = language === 'en';
  const sourceRepos = eligibleRepos(repos, owner).filter(repo => !repo.fork);
  const languages = new Map(repositoryLanguages.map(value => [value.toLowerCase(), value]));
  const signals = new Set(languages.keys());
  for (const repo of sourceRepos) {
    if (repo.language) {
      signals.add(repo.language.toLowerCase());
      languages.set(repo.language.toLowerCase(), repo.language);
    }
  }
  const searchable = eligibleRepos(repos, owner).map(repo => {
    for (const topic of repo.topics || []) signals.add(topic.toLowerCase());
    return [repo.name, repo.description, repo.language, ...(repo.topics || [])]
      .filter(Boolean).join(' ').toLowerCase();
  }).concat(repositoryTexts).join(' ').toLowerCase();
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
  const repositoryTexts = [];
  await Promise.all(eligibleRepos(repos, owner).filter(repository => !repository.fork)
    .map(async repository => {
      const { data: languages } = await github.rest.repos.listLanguages({
        owner, repo: repository.name,
      });
      for (const language of Object.keys(languages)) repositoryLanguages.add(language);
      try {
        const { data: readme } = await github.rest.repos.getReadme({
          owner, repo: repository.name,
        });
        if (readme.encoding === 'base64' && typeof readme.content === 'string') {
          repositoryTexts.push(Buffer.from(readme.content, 'base64').toString('utf8'));
        }
      } catch (error) {
        if (error.status !== 404) throw error;
      }
    }));
  const changes = [];
  for (const [path, language] of [['README.md', 'en'], ['README.en.md', 'en'], ['README.zh-CN.md', 'zh']]) {
    const { data: file } = await github.rest.repos.getContent({ owner, repo, path, ref: branch });
    if (file.type !== 'file' || file.encoding !== 'base64') {
      throw new Error(`${path} is not a readable base64 file.`);
    }
    const previous = Buffer.from(file.content, 'base64').toString('utf8');
    const next = renderProfile(previous, repos, owner, language, [...repositoryLanguages], repositoryTexts);
    if (next !== previous) changes.push({ path, sha: file.sha, next });
  }
  // Validate every document first; each file SHA protects concurrent edits.
  for (const { path, sha, next } of changes) {
    await github.rest.repos.createOrUpdateFileContents({
      owner, repo, branch, path, sha,
      message: `docs: 自动更新主页介绍与项目目录 (${path}) [skip ci]`,
      content: Buffer.from(next, 'utf8').toString('base64'),
    });
    core.info(`Updated introduction, portfolio, latest projects and tech stack in ${path}.`);
  }
  if (!changes.length) core.info('Profile content unchanged; no commit needed.');
}

module.exports = update;
module.exports.render = render;
module.exports.renderTechStack = renderTechStack;
module.exports.replaceSection = replaceSection;
module.exports.replaceTechStack = replaceTechStack;
module.exports.renderProfile = renderProfile;
