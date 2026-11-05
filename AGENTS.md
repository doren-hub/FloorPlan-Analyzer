# Repository instructions

Follow [docs/development-workflow.md](docs/development-workflow.md) for all implementation work. If `docs/roadmap.md` exists, use it to order implementation issues. Otherwise, use explicitly requested issues or the repository’s GitHub issue priorities and dependencies.

## Required delivery loop

Target branch: `main` (`base_branch` in `.kurukuru.toml`, default `main`). Create work branches and PRs against this branch.

1. Work on exactly one open implementation issue at a time, following the issue selection rules in `docs/development-workflow.md`.
2. Create a branch named `codex/<short-description>`.
3. At the beginning of the issue, create an empty kickoff commit, push the branch, and open a Draft PR containing `Closes #<issue>`.
4. Implement the complete issue, including tests, static checks, documentation, and PR-body updates.
5. Run an independent Claude Code review with Claude Opus 5.5 at low effort (`kurukuru review <issue> <pr>`). Preserve and reuse the same Claude review session for every re-review of that PR.
6. Fix every actionable in-scope finding, rerun verification, and ask Claude to review again. Repeat until Claude explicitly returns `OK`.
7. If Claude identifies a worthwhile improvement outside the current issue, create a separate GitHub issue with acceptance criteria and continue the current issue without expanding its scope.
8. After the configured local test command verification and Claude returns `OK`, update the PR body with final changes, verification results, limitations, and follow-up issues; mark the PR ready; wait for CI to pass; merge it; verify the linked issue closed; then begin the next issue if it is within the owner’s requested scope.
9. Continue this loop until all selected issues are closed, within the owner’s requested scope.

## Sessions

Run each issue in a fresh Codex session (`kurukuru run`) and follow the context-budget and per-session `ai-dispatch-log` rules in `docs/development-workflow.md`.

The owner or outer orchestrator starts those sessions. Inside a runner session, never invoke `kurukuru run`, `kurukuru exec`, or `kurukuru queue` (including `queue run`), or `kurukuru batch`: this would recursively start runners. Complete only the assigned issue in the current session. `kurukuru review` and `kurukuru ci-wait` remain available.

## Worktree locations

- Queue-managed worktrees are reserved for kurukuru. In particular, `[runner].worktree_path` in `.kurukuru.toml` (default `.worktrees/kurukuru-run`, relative to the source repository) is queue-only: when working outside the queue, never create or use a worktree at that path. Do not reuse automatically allocated queue worktrees either.
- For direct app sessions or other work outside the queue, create a separate linked worktree from the source repository at `../<repo>-codex-manual-<issue>`; replace `<repo>` with the source repository name and `<issue>` with the issue number. Check `git worktree list` and the configured queue path first. If the manual path is occupied or resolves to a queue path, choose a new unused `-<session>` suffix; never take over an existing worktree.
- Finish and preserve the work before cleanup. After committing, pushing and completing delivery, leave the manual worktree and run `git worktree remove <manual-path>` from the source repository. If removal refuses because of remaining changes, preserve and resolve them; do not force removal. Queue worktrees are cleaned up by kurukuru, not by direct app sessions.

## Configured project constraints

The constraints below come from `.kurukuru.toml`. Also follow the
[repository-local instructions](#repository-local-instructions), including any
additional project constraints and roadmap guidance there.

- Preserve application behavior and the existing README; onboarding is management-only.
- Never read credentials, .env* (including examples), or auth.json. Verification requires no real Gemini API key.
- Preserve AI Studio DISABLE_HMR behavior and existing Vite configuration.
- Never modify the source checkout from the independent onboarding clone or register that clone.
- Merge only after same-head local verification, Claude OK, and kurukuru ci-wait exit 0; no No-CI exception.
- Do not register CI runners, change runner configuration, bypass permissions, or recursively launch runners.

## Verification

- Test: `npm run build`
- Lint: `npm run lint`

## Additional review notes

- Read AGENTS.local.md. The test gate is the existing Vite production build, not an automated functional test suite.
- Use Read/Glob/Grep only; the caller supplies head-bound local verification while Draft. Reuse the same session.

## Repository-local instructions

# FloorPlan Analyzer: repository-local instructions

## Project and existing documentation

- This is the React 19 / TypeScript / Vite FloorPlan Analyzer exported from Google AI Studio. Preserve the existing README.md and its AI Studio app link and local setup instructions; this onboarding does not replace the separate README refresh PR.
- Node.js and npm are required. Existing commands are `npm install`, `npm run dev` (port 3000, host 0.0.0.0), `npm run build`, `npm run preview`, `npm run clean` (removes dist), and `npm run lint` (TypeScript `tsc --noEmit`).
- There is no automated test script or test suite in the initial repository. The configured `test` gate runs the existing production build; it is a build smoke check, not functional or Gemini integration coverage. Run lint separately.
- The original README tells the owner to configure GEMINI_API_KEY in .env.local for interactive use. Agents must never read credentials, `.env*` (including the example), or `auth.json`. Build and lint require no real API key; do not create secret files or call Gemini during verification.
- Preserve vite.config.ts behavior: HMR is disabled by DISABLE_HMR in AI Studio to prevent flickering; do not change file watching or HMR as part of onboarding. Preserve the `@` alias and existing Gemini configuration.
- Keep application behavior and source files unchanged for onboarding. Do not start other issues or modify the original checkout `/Users/doren/Developer/FloorPlan-Analyzer` from this independent clone.

## Delivery and safety

- Use `codex/<short-description>`, an empty kickoff commit and a Draft PR with `Closes #<issue>`. Reuse an existing onboarding issue/PR when present.
- Preserve unique content before replacing generated documents; include preservation and replacement together in a reviewable PR diff. Edit this file and `.kurukuru.toml`, then regenerate AGENTS.md and docs/development-workflow.md through `kurukuru init`; require `kurukuru init --check` exit 0.
- Keep Draft until configured build/lint pass and independent Claude Opus 5.5 low effort read-only review returns standalone `OK` for the exact current head. Record execution timestamp, elapsed time, head SHA, commands and exit codes in the PR. Reuse the same review session for every re-review.
- Reviewer tools are Read/Glob/Grep only (`[review].read_only = true`); never expand permissions or read secrets. The caller supplies verification evidence.
- Stricter merge gate: after Ready run `kurukuru ci-wait` once per reviewed head, wait for its final summary, and merge only on exit 0 using the exact reviewed head. No CI (exit 4) never authorizes a merge here. Keep Ready after a failure, fix, rerun local verification and re-review in the same session, then wait for CI on the new head.
- The owner has authorized the normal PR/review/merge workflow. Do not register CI runners, change runner configuration, bypass permissions, or launch `kurukuru run/exec/queue/batch` recursively.
- The outer caller owns ai-dispatch-log recording; do not run start, finish, codex-attach or antigravity-attach yourself.
- Do not register this independent clone. After merge, tell the owner to fast-forward the original checkout when safe, then run `kurukuru repos add /Users/doren/Developer/FloorPlan-Analyzer`.


## Autonomy

- Do not request routine user approval between implementation steps, reviews, PR operations, merges, or issue transitions. The repository owner has authorized this workflow.
- Preserve normal tool, operating-system, repository, and agent safety controls. Never bypass permission systems merely to avoid a prompt.
- Ask the user only when work requires authority not already granted, a product decision that materially changes scope, an unavailable credential/account action, or recovery from an unsafe/destructive ambiguity.
- When an external service is temporarily unavailable, retry safe operations and continue other in-scope work before treating it as a blocker.

## CI waiting

After Ready, invoke `kurukuru ci-wait <pr>` once per reviewed head and wait for its final summary. Supply that final summary plus its pinned head SHA as Ready CI evidence. Do not repeatedly poll `gh pr checks`. Merge on exit 0, or on exit 4 (No CI) only with local verification and Claude OK for the same head recorded in the PR body; head changes require fresh verification and review. Failures retain Ready and follow the repair/re-review loop.

For sessions launched by `kurukuru run`, the runner prompt supplies a stricter merge policy: exit 0 only by default. Repository-only `[ci] merge_without_ci = true` additionally permits exit 4 (No CI) only with freshly passed configured local `test` and Claude OK for the same current head. Record the head SHA, ci-wait final summary, test command, execution time, exit code and result in the PR body. Merge using `--match-head-commit <verified-head-SHA>`. An empty or missing `test` forbids this exception. Legacy exit 5, failed, pending, cancelled, skipped, unavailable or timed-out CI do not qualify for the runner exception. A head change invalidates all evidence: rerun local verification, obtain Claude OK and wait for CI on the new head. The documented workflow above is unchanged; this opt-in changes only runner instructions.

## CI rules

- Every workflow must set `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }` to cancel superseded runs.
- Do not run CI for Draft PRs. Gate PR jobs with `if: github.event.pull_request.draft == false` and include `ready_for_review` in pull request event types so marking Ready starts CI.
- When adding a macOS job, require a `paths` filter limited to the app's files and `.github/workflows/ci.yml`; for mixed-platform workflows, use job-level path detection so unrelated Linux checks still run. Use `runs-on: [self-hosted, macOS]` for all jobs; never fall back to paid GitHub-hosted runners. Guard every PR job with `github.event.pull_request.head.repo.full_name == github.repository` to exclude forks. Disable checkout credential persistence and clean the workspace before and after each job. See [owner setup and offline operation](https://github.com/doren-hub/kurukuru/blob/main/docs/self-hosted-runners.md).
- Self-hosted macOS jobs must use `python3` from the runner account PATH and verify Python 3.11.8 or newer before tests. Do not use `actions/setup-python`: it forces a GitHub-hosted macOS cache path. Install Python beforehand (for example with Homebrew); the runner PATH is captured at registration. Do not change runner configuration files.
- Run the configured local test command (`test` in `.kurukuru.toml`) and lint command (`lint`, when configured), and pass both before starting CI.
- Do not start Docker or any container/VM runtime unless the owner explicitly requests it.

## Claude review guidance

The default review contract is in
[the development workflow](docs/development-workflow.md#default-claude-review-contract).
[Repository-local instructions](#repository-local-instructions), sourced from
`AGENTS.local.md` when present, take precedence over the generated review defaults.
Apply stricter local reviewer permissions and evidence requirements; the defaults
never authorize expanding those permissions. Keep local instructions verbatim.

## Creating issues

Classify every issue you create with labels. The canonical rules are `CLAUDE.md` and `.github/labels.yml` in doren-hub/build-next (aligned with main revision `81f872a151765fdb6191e4f6c92a969dee0003fd`). Ask before creating an issue when the type or domain is unclear.

- Exactly one type label, and a matching title prefix:
  - `type: 機能追加` `[機能追加]`: adds a new capability (feature, part, circuit block).
  - `type: 機能改善` `[機能改善]`: improves something that already works (speed, robustness, usability, size, noise). Also use it for things that are risky or slow but have not actually malfunctioned.
  - `type: 不具合修正` `[不具合]`: something does not meet its specification or expectation and has actually misbehaved.
  - `type: 調査` `[調査]`: research whose main output is a decision or document (comparison, selection, PoC to decide feasibility).
  - `type: 検証` `[検証]`: checks that something already built meets its requirements (real hardware, prototype, measurement).
  - `type: タスク` `[タスク]`: work that does not change product behavior (CI, tests, refactoring, migration, settings, docs, drawings, ordering, BOM).
- One or more domain labels: `domain: ソフト` (runs on an OS, including ROS 2), `domain: メカ` (enclosures, mechanisms, parts), `domain: 回路` (schematics, boards), `domain: ファーム` (runs directly on a microcontroller). Add several when the work spans domains.
- A missing requirement in a design (for example, no place for a required part) is `type: 機能追加`.
- When the main output is a decision or document, use `type: 調査`. When the output is code or drawings, use `type: 機能追加` or `type: 機能改善`, even for a PoC.
- Add `tracking` to parent issues that summarize the progress of other issues. Owner decision (2026-10-29): `tracking` exempts only the CI classification check; at creation, tracking issues must still have exactly one `type:` label and one or more `domain:` labels, the matching title prefix, and the required body format.
- Add `owner-action` when the owner must act (hardware operation, production change, ordering, credentials).
- Use repository-specific `area:`, `phase:`, or `priority:` labels when needed.
- Do not use GitHub's default `enhancement`, `bug`, or `documentation` labels, or the automatic `type: 未分類` / `domain: 未分類` labels.
- Start the body with `### 分野` listing the chosen domains separated by commas (for example, `ソフト, 回路`), then use the headings of the matching issue template below, in order. These headings are included here so issue creation does not depend on the forms being distributed to the repository.

| Type | Body headings |
| --- | --- |
| `type: 機能追加` | 分野 / 目的・背景 / 実現したいこと / 関連する要件 / 完了条件 |
| `type: 機能改善` | 分野 / 対象 / 現状の課題 / 改善案 / 関連する要件 / 完了条件 |
| `type: 不具合修正` | 分野 / 現象 / 発生条件・再現手順 / 期待する状態 / 対象 / 環境・補足 |
| `type: 調査` | 分野 / 調べたいこと / 判断に使う観点 / 成果物 |
| `type: 検証` | 分野 / 対象 / 確かめる要件 / 方法・条件 / 合格の基準 / 結果 |
| `type: タスク` | 分野 / 内容 |

## Pull request body

Before marking a PR ready, include:

- summary and background;
- main changes;
- tests and static checks with results;
- known limitations, deferred work, and review notes;
- `Closes #<issue>`.

## Draft verification

Keep PRs Draft through the configured local test command and Claude review until `OK`.
Supply local execution time, head SHA, command, and exit code instead of Draft CI.
The reviewer must not return `OK` for missing evidence or a SHA different from
the current PR head. Ready CI is the final gate. If it fails, keep the PR Ready,
fix and push, rerun local checks, and re-review the changed diff in the same
Claude session until `OK`, then wait for CI on that head before merging.
