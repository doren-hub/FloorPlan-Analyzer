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
