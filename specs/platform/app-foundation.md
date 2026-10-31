---
id: platform/app-foundation
title: App foundation
module: platform
summary: Minimal static Next.js skeleton with a client-only localStorage helper, basic tooling and CI, deployed to Vercel on Node 26; no backend, no login.
entities: [StorageResult]
status: active
issues: [7, 12]
updated: 2026-10-31
---
# App foundation

## Current behaviour
- The app is a static Next.js project (App Router, TypeScript, npm) exported with `output: 'export'`. It has no backend, no API routes and no login.
- The home page shows only the app title. There are no habit features in the skeleton.
- Styling uses CSS Modules and a global stylesheet. There is no UI library or Tailwind.
- The page sets `lang="en"` and a viewport meta tag. The base layout is responsive from 320px with no horizontal scroll.
- One client-only storage helper module reads and writes JSON under a key in `localStorage`. It never throws. It returns a failure result when storage is unavailable, full or corrupted. Nothing touches `localStorage` during build or server render.
- Tooling: ESLint (Next.js config), Prettier, a `typecheck` script and Vitest with one example test. There are no end-to-end tests.
- A GitHub Actions workflow runs lint, typecheck, test and build on pull requests, using the Node version from `app/.nvmrc`.
- The app is deployed to Vercel with default settings: root directory `app/`, Next.js preset, npm install, static export output. Production deploys from `main`; each pull request gets a preview URL.
- Node 26 is pinned in `app/.nvmrc` (`26`) and `engines.node` (`26.x`). The same version applies in CI and on Vercel. Lint, typecheck, test and build pass unchanged on it.
- Supported browsers are the latest two versions of Chrome, Firefox, Safari and Edge.
- The README covers how to run, test and build, the Node version, how deployment works, the folder layout, and the "static, localStorage only" rule.
- The only runtime dependencies are Next.js and React.
- Hosting does not change where data lives: it stays in the user's browser.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | The skeleton has only a home page with the app title and no habit features. | #7 | https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793401372777239?thread_ts=1793401372.777239&cid=C0CDNGE90V7 |
| D2 | Next.js App Router, TypeScript, npm, static export, no API routes or server code. | #7 | same thread |
| D3 | Plain CSS Modules plus a global stylesheet; no UI library or Tailwind. | #7 | same thread |
| D4 | The storage helper returns a failure result on error; UI handling of failures is defined in `habits/habit-management` (D9, D19). | #7 | same thread |
| D5 | One small typed, client-only, never-throwing storage helper; it uses the key `habits:v1`. | #7 | same thread |
| D6 | `lang="en"`, a viewport meta tag, and a responsive base layout from 320px with no horizontal scroll. | #7 | same thread |
| D7 | ESLint, Prettier, a `typecheck` script and Vitest with one example test; no end-to-end tests. | #7 | same thread |
| ~~D8~~ | ~~No deployment; GitHub Actions runs lint, typecheck, test and build on pull requests.~~ → superseded by D13 (#12) | #7 | same thread |
| ~~D9~~ | ~~Node 20 LTS pinned in `.nvmrc` and `engines`; the latest two versions of Chrome, Firefox, Safari and Edge.~~ → superseded by D14 (Node) and D15 (browsers) (#12) | #7 | same thread |
| D10 | A short README is the only documentation. | #7 | same thread |
| D11 | Only Next.js, React and the dev tooling are allowed; any other runtime dependency needs team agreement. | #7 | same thread |
| D12 | Keep the setup minimalist and simple. | #7 | same thread |
| D13 | Deployment to Vercel is allowed with default settings: root `app/`, Next.js preset, npm, static export, Node from `engines`. Production deploys from `main`, each PR gets a preview. No custom domain, analytics, env vars or `vercel.json` unless Vercel needs it. GitHub Actions still runs lint, typecheck, test and build on PRs. Data stays in `localStorage`; nothing is stored on Vercel. | #12 | https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793445910352449?thread_ts=1793445910.352449&cid=C0CDNGE90V7 |
| D14 | Node 26 is pinned: `app/.nvmrc` = `26`, `engines.node` = `26.x`. One version applies in `.nvmrc`, `engines`, CI (reads `app/.nvmrc`) and Vercel. Later majors need their own change. Existing checks must pass unchanged; only a minimum dependency bump is allowed, under D11. | #12 | same thread |
| D15 | Supported browsers: the latest two versions of Chrome, Firefox, Safari and Edge (carried over from D9). | #12 | same thread |

## Data
- `StorageResult`: the helper's result, either success with a value or failure with a reason.
- `localStorage` key `habits:v1`: JSON data owned by the habits capabilities. The helper only reads and writes it.

## Not covered
- Any habit feature (see `habits/habit-management`).
- Custom domain, analytics, environment variables and a Vercel config file (`vercel.json`), unless Vercel requires it.
- End-to-end tests.
- Backend, API routes, login and accounts.

## History
- 2026-10-30 #7: Created the app foundation (skeleton, storage helper, tooling, CI, Node and browser support).
- 2026-10-31 #12: Allowed deployment to Vercel (D13), pinned Node 26 everywhere (D14), kept browser support (D15); superseded D8 and D9.
