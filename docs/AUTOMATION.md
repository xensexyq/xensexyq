# Profile updates

[English](AUTOMATION.md) · [简体中文](AUTOMATION.zh-CN.md) · [Profile](../README.md)

## 1. What changes automatically

The GitHub Actions workflow reads all pages of the account's public repository list and refreshes four marked sections in `README.md`, `README.en.md` and `README.zh-CN.md`:

| Section | Content |
| --- | --- |
| `ABOUT` | Current project count and an overview of project areas, with example links |
| `PORTFOLIO` | Every eligible project, its area and its repository description |
| `PROJECTS` | The three newest projects, ordered by creation time |
| `TECH_STACK` | Technology badges detected from public repository metadata, language inventories and READMEs |

Private, archived, forked, foreign-owned and profile repositories are excluded from the overview and catalog. New domains that do not match an existing category appear under **Other tools and resources**. Categories use the repository name, description and topics; they summarize the portfolio, not a person's qualifications. The first matching category is used, so a multidisciplinary project appears once. Raw repository descriptions retain their original language in both versions.

The profile keeps its original two-column layout: introduction, toolbox and contacts on the left; statistics and latest projects on the right. The full catalog and collaboration notes sit in a collapsed section below. The greeting, contact details and team collaboration links remain hand-written. Technology badges summarize source mentions, not proficiency or verified hardware support. Overview classification deliberately does not use README text: a resource list may mention technologies the author has never implemented.

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
