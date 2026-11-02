# Profile updates

[English](AUTOMATION.md) · [简体中文](AUTOMATION.zh-CN.md) · [Profile](../README.md)

## 1. What changes automatically

The GitHub Actions workflow reads all pages of the account's public repository list and refreshes four marked sections in `README.md`, `README.en.md` and `README.zh-CN.md`:

| Section | Content |
| --- | --- |
| `ABOUT` | Robotics, embedded systems and robot-perception experience selected from current project areas, without project links or counts |
| `PORTFOLIO` | Every eligible project, its area and its repository description |
| `PROJECTS` | The three newest projects, ordered by creation time, with the linked name, language and description flowing in one paragraph per project; no forced line break after the name |
| `TECH_STACK` | Technology badges detected from public repository metadata, language inventories and READMEs, in an unbordered block with category icons, aligned row starts and at most four badges per line |

Private, archived, forked, foreign-owned and profile repositories are excluded from the overview and catalog. New domains that do not match an existing category appear under **Other tools and resources**. Categories use the repository name, description and topics; they summarize the portfolio, not a person's qualifications. The first matching category is used, so a multidisciplinary project appears once. Raw repository descriptions retain their original language in both versions.

The default profile (`README.md`) and `README.en.md` are English; Chinese remains in `README.zh-CN.md`. The profile keeps its two-column layout: independent columns in a 60:40 ratio with the introduction and latest projects on the left, and statistics, the toolbox and language distribution (in that order) on the right. A shared contact footer spans both columns. Compact statistics cards hide repeated titles while retaining the counters, full rank circle and language distribution. The statistics card uses a 470-pixel source width and 20-pixel row spacing to accommodate the rank; the language card uses a 360-pixel source width. The full catalog and collaboration notes sit in a collapsed section below. The greeting, contact details and team collaboration links remain hand-written. About Me emphasizes engineering approach and project experience; it is not a repository index. Technology badges summarize source mentions, not proficiency or verified hardware support. Overview classification deliberately does not use README text: a resource list may mention technologies the author has never implemented.

## 2. When it runs

The existing schedule requests a daily run at **09:17 Asia/Shanghai** (`01:17 UTC`); GitHub may delay it. A new repository does not immediately trigger this profile's workflow. It is picked up on the next scheduled run, or when the repository owner runs **Update profile introduction and projects** manually from Actions.

Changes to the updater, tests, workflow or any of the three READMEs on `main` also trigger the workflow. The workflow runs regression tests before generating content. The updated workflow and all README files must be published to the default branch before the new behavior is active.

Only the built-in `GITHUB_TOKEN` is needed, with write access to this profile repository. No personal token, private-project access or external AI service is needed. Automatic commits update README content on the default branch; the account's short **Bio** is not modified.

## 3. Maintenance and failure handling

Keep exactly one ordered `START` / `END` marker pair for each section in every README. Text outside these markers is preserved. Generated sections may be overwritten on the next run; update repository descriptions/topics or the category rules in `scripts/update-projects.cjs` instead.

Run the checks locally:

```bash
node --test tests/update-projects.test.cjs
```

The updater fetches inputs and validates every document before writing any of them. Missing READMEs in source projects are allowed; other API errors stop the run. A missing or malformed profile marker prevents all writes. Identical inputs produce identical content and no extra commit. Each file update checks its previous SHA; the three file writes are sequential rather than a single atomic transaction. If a write fails midway, inspect the Actions log and rerun after resolving the failure.

If a project is absent, check whether it is public, unarchived, owned by the account and not a fork, then inspect the latest Actions run. If a category is wrong, adjust its description/topics or the small `FOCUS_AREAS` rules. Repository visibility changes and deletions are reflected on the next successful run; removing a link does not remove older Git history.
