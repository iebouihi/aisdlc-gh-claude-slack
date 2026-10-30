---
updated: 2026-10-30
issues: [7]
---
# good-habit-tracker: code map

Living context for anyone changing the code, people and agents alike. Keep it true: every PR
that changes structure, a convention or a module updates this file (see the `code-map` skill).
*What* the product does lives in `specs/`; this file says *where* and *how* it is built.

## Stack
- Next.js (App Router) with **static export** (`output: "export"`): plain HTML/JS, no server,
  no API routes, no server actions. Everything runs in the browser.
- React, TypeScript (strict). No state library; React state and small custom hooks.
- Tests: Vitest + Testing Library (jsdom). `npm run check` = lint + typecheck + tests + build.
- Tooling: ESLint (`eslint-config-next`), Prettier (`npm run format`), Node 20 (`.nvmrc`, `engines`).
- Styling: a global stylesheet with CSS variables (`src/app/globals.css`), light and dark, plus
  CSS Modules per page/component (`*.module.css`). No Tailwind or UI library.

## Structure
| Path | What lives there |
|---|---|
| `src/app/` | routes (`page.tsx`), the root layout and global styles |
| `src/components/` | UI components, one per file (`HabitList.tsx`), with a colocated test |
| `src/lib/` | domain logic as pure functions and the storage adapter; no React |

## Modules
| Module | Files | Spec |
|---|---|---|
| App shell | `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/page.module.css` | platform/app-foundation |
| Storage helper | `src/lib/storage.ts` (`readJson`, `writeJson`, `HABITS_KEY` = `habits:v1`; return a `StorageResult`) | platform/app-foundation |
| Setup checks | `src/lib/project-setup.test.ts` (config and dependency rules) | platform/app-foundation |

## Conventions
- **Domain logic is pure** and lives in `src/lib/` (validation, sorting, IDs, dates), tested
  without rendering. Components stay thin.
- **Browser storage only through one adapter** in `src/lib/` (versioned key, safe parse, never
  throws to the UI). Components never touch `localStorage` directly. Static export means no
  `window` at build time: read storage in effects or client components, never during render on
  the server.
- **Tests are traceability:** a test that verifies an acceptance criterion starts its name with
  the criterion ID and the issue: `it("AC3 (#1): empty name shows an inline error", ...)`.
- **Accessibility is not optional:** labelled controls, keyboard operation, visible focus,
  errors announced (`role="alert"` or `aria-describedby`), WCAG AA contrast.
- Client components start with `"use client"` only where they need state or effects.
- Runtime dependencies are only `next`, `react`, `react-dom` (enforced by a test).
- No new runtime dependency without a reason in the PR description.

## Decisions
| ID | Decision | Since |
|---|---|---|
| A1 | Static export; no backend | foundation |
| A2 | Domain logic pure in `src/lib/`, storage behind one adapter | foundation |
| A3 | Vitest + Testing Library; tests named after acceptance criteria | foundation |
| A4 | TypeScript 5.9 (strict) until Next.js supports the native TypeScript 7 compiler | foundation |
