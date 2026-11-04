---
updated: 2026-11-04
issues: [1, 2, 3, 4, 7, 12, 15, 24, 27, 30, 33, 36, 39]
---

# good-habit-tracker: code map

Living context for anyone changing the code, people and agents alike. Keep it true: every PR
that changes structure, a convention or a module updates this file (see the `code-map` skill).
_What_ the product does lives in `specs/`; this file says _where_ and _how_ it is built.

## Stack

- Next.js (App Router) with **static export** (`output: "export"`): plain HTML/JS, no server,
  no API routes, no server actions. Everything runs in the browser.
- React, TypeScript (strict). No state library; React state and small custom hooks.
- Tests: Vitest + Testing Library (jsdom). `npm run check` = lint + typecheck + tests + build.
- Tooling: ESLint (`eslint-config-next`), Prettier (`npm run format`), Node 26 (`.nvmrc` = `26`, `engines.node` = `26.x`).
- Styling: a design-token stylesheet (`src/app/tokens.css`: colours, spacing, type, radius; light
  only, one accent) imported by `src/app/globals.css`, plus CSS Modules per page/component
  (`*.module.css`). No Tailwind or UI library, no dark mode.

## Structure

| Path              | What lives there                                                     |
| ----------------- | -------------------------------------------------------------------- |
| `src/app/`        | routes (`page.tsx`), the root layout and global styles               |
| `src/components/` | UI components, one per file (`HabitList.tsx`), with a colocated test |
| `src/lib/`        | domain logic as pure functions and the storage adapter; no React     |

## Modules

| Module          | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Spec                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| App shell       | `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/page.module.css`                                                                                                                                                                                                                                                                                                                                                                                                      | platform/app-foundation                        |
| Storage helper  | `src/lib/storage.ts` (`readJson`, `writeJson`, `HABITS_KEY` = `habits:v1`, `CHECKINS_KEY` = `checkins:v1`; return a `StorageResult`)                                                                                                                                                                                                                                                                                                                                     | platform/app-foundation                        |
| Habit domain    | `src/lib/habits.ts` (`validateName`, `parseHabits`, `addHabit`, `updateHabit`, `removeHabit`; pure) and `src/lib/icons.ts` (24-emoji `ICON_CATALOG`, `iconEmoji` with default fallback)                                                                                                                                                                                                                                                                                  | habits/habit-management                        |
| Schedule domain | `src/lib/schedule.ts` (`Frequency`, `Schedule`, `validateSchedule`, `parseFrequency`, `isLocalDate`, `toLocalDate`, `summarize`, `hasEnded`, error texts; pure). `Habit` has required `frequency` and `startDate` in memory, optional `endDate`                                                                                                                                                                                                                          | habits/habit-management                        |
| Check-in domain | `src/lib/checkins.ts` (`CheckIn`, `todayStatus`, `parseCheckins`, `isChecked`, `toggleCheckIn`, `removeCheckInsFor`, `todaySummary`; pure)                                                                                                                                                                                                                                                                                                                               | habits/daily-check-in                          |
| Habit UI        | `src/components/HabitList.tsx` (state, storage wiring, add form, inline edit, focus), `ScheduleFields.tsx` (frequency radios, weekday checkboxes, date inputs, draft helpers), `IconPicker.tsx`, `DeleteDialog.tsx`, `HabitList.module.css`; rendered by `src/app/page.tsx`. `HabitList` also owns check-in state, the row checkbox and the "x of y done today" summary                                                                                                  | habits/habit-management, habits/daily-check-in |
| Streaks         | `src/lib/streak.ts` (`currentStreak`, `streakText`, `NO_STREAK_TEXT`; pure) and `StreakLine` in `HabitList.tsx` (icon + text under each today-list row; no new storage)                                                                                                                                                                                                                                                                                                  | habits/habit-streaks                           |
| Weekly overview | `src/lib/week.ts` (`weekWindow`, `cellState`, `weekRows`, `summaryText`; pure) and `src/components/WeekView.tsx` + `WeekView.module.css` (read-only table, rendered by `HabitList` in a "Week" section below the today list; no new storage)                                                                                                                                                                                                                             | habits/weekly-overview                         |
| Badges          | `src/lib/badges.ts` (`BADGES`, `bestStreak`, `awardBadges`, `newBadgeIds`, `parseBadges`; pure) and `src/components/Badges.tsx` + `Badges.module.css` (read-only groups, rendered by `HabitList` in a "Badges" section below the Week section). Stored in `badges:v1` (`BADGES_KEY`)                                                                                                                                                                                     | habits/discipline-badges                       |
| Progress chart  | `src/lib/progress.ts` (`progress`, `periodDays`, `percentOf`, `figureText`, `PERIODS`; pure) and `src/components/ProgressView.tsx` + `ProgressView.module.css` (read-only, hand-built SVG/CSS, no new storage; rendered by `HabitList` in the Progress view)                                                                                                                                                                                                             | habits/habit-progress-chart                    |
| App navigation  | `src/components/AppNav.tsx` + `AppNav.module.css` (top nav, four buttons: Today, Week, Progress, Habits; `aria-current="page"`, bold + underline) and `View` state in `HabitList`. Today = check-in list, streaks, Badges; Week = `WeekView`; Progress = `ProgressView`; Habits = add form, edit, delete. Tests use `src/components/test-utils.tsx` (`renderView`, `goTo`)                                                                                               | platform/app-navigation                        |
| User profile    | `src/lib/profile.ts` (`validateProfileName`, `parseProfile`, `welcomeText`, `latestBadge`; pure) and `src/components/ProfileName.tsx` (inline name editor in the Habits view). `HabitList` renders the welcome heading + latest badge in the Today view. Stored in `profile:v1` (`PROFILE_KEY`) as `{name}`                                                                                                                                                              | habits/user-profile                            |
| Habit budget    | `src/lib/budget.ts` (`validateMoney`, `parseAmount`, `parseBudget`, `periodRange`, `budgetStatus`, `formatAmount`, `spentText`, `overText`; pure) and `src/components/BudgetFields.tsx` (cost, budget amount, period inputs in the add and edit forms). `BudgetLine` in `HabitList.tsx` renders the summary in the Habits-view row only. `Habit` gets optional `cost` (number) and `budget` (`{amount, period: "weekly"｜"monthly"}`) in `habits:v1`; no new storage key | habits/habit-budget, habits/habit-management   |
| Reminders       | `src/lib/reminders.ts` (`dueReminders`, `dismissalKey`, `toLocalTime`; pure), `isReminderTime` in `schedule.ts`, the time input in `ScheduleFields.tsx` and the banner in `HabitList.tsx` (Today view, above the list). `Habit` and `Schedule` get optional `reminderTime` ("HH:mm") in `habits:v1`; no new storage key                                                                                                                                                  | habits/habit-reminders                         |
| Design tokens   | `src/app/tokens.css` (the only place with colour values; `color-scheme: light`), checked by `project-setup.test.ts`                                                                                                                                                                                                                                                                                                                                                      | platform/ui-design-system                      |
| Setup checks    | `src/lib/project-setup.test.ts` (config and dependency rules)                                                                                                                                                                                                                                                                                                                                                                                                            | platform/app-foundation                        |

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
- **Storage is read in an effect** (`HabitList`), and the list renders nothing until `loaded`, so
  there is no empty-state flash and the static build never touches `localStorage`.
- **Focus moves through `pendingFocus` + `data-focus` attributes:** an action stores a selector,
  and an effect focuses it after the next render.
- **Stored data is validated in `parseHabits`:** a malformed entry means corrupted (`null`); an
  unknown `icon` is dropped silently. Corrupted data is only overwritten on the next save.
- **Dates are local `"YYYY-MM-DD"` strings**, compared as strings; "today" is `toLocalDate(new Date())`,
  never UTC. Weekdays are numbered like `Date.getDay` (0 = Sunday) and shown Monday first.
- **Legacy habits are normalised in `parseHabits`** (missing frequency/startDate → Daily from the
  local `createdAt` date); no migration is written until the next save. A present but malformed
  schedule field is corrupted.
- **Edit validation compares with the stored habit** (`validateSchedule(…, today, previous)`): the
  past-date rule applies only to a changed start or end date. The add form's start date is set in
  the load effect, so the static build never contains a build-time date.
- **Check-ins are `{habitId, date}` entries in `checkins:v1`**, separate from `habits:v1`. `HabitList` keeps `today` in state (empty until mounted) and refreshes it on window focus, `visibilitychange` and any pointerdown/keydown; toggles always use that `today`. Corrupted check-ins start empty and are not overwritten until a save; deleting a habit removes its entries. If habits storage already shows an error, the check-in error is not shown twice.
- **The Week view is computed, never stored:** `weekRows(habits, checkins, today)` derives cells from `habits:v1` and `checkins:v1` using `HabitList`'s `today`, so it follows toggles and date changes. A check-in always shows as done; it counts in "x of y" only on scheduled, active days. Cell state is an icon plus visually hidden text (`<habit>, <weekday> <day>: <state>`).
- **Streaks are computed, never stored:** `currentStreak(habit, checkins, today)` walks back from today (or the end date) to the start date counting checked scheduled days; unscheduled days are skipped, an unchecked today is neither counted nor breaking. Shown only in the today list, and hidden when `checkins:v1` is in error. The row text has a visually hidden "Run: " prefix (class `visuallyHidden`).
- **Badges are a fixed set in code; only the earned ones are stored** (`badges:v1` = `[{badgeId, earnedAt}]`, one per badge, never removed). `awardBadges` uses `bestStreak` (longest past or current run of a single habit, same counting as `currentStreak`) and runs on load and after each toggle, dating new badges `today`. "New" labels live in `HabitList` state only, so they vanish on the next load. Corrupted badges: error alert (only if no other storage alert), all Locked, nothing written until a toggle earns a badge. Badges render as `role="group"` blocks (not a list) with the "New" label as `aria-live="polite"`, so they don't collide with the habit list's `listitem` and `status` queries.
- **The profile is just an optional name** (`profile:v1` = `{name}`, trimmed, 1–30 characters, rendered as React text, never HTML; empty save stores `""`). The welcome badge is `latestBadge(badges)` (latest `earnedAt`, ties go to the later badge in `BADGES` order), taken once in the load effect and kept in `welcomeBadge` state, so badges earned during the visit change it only on the next load. A corrupted profile shows "Welcome" and an alert (only if no other storage alert) and is not overwritten until a name is saved.
- **Views are in-page state, not routes:** `HabitList` keeps `view` (`today` | `week` | `progress` | `habits`, starts on Today; not stored, no URL change). All data state stays in `HabitList`, so switching views loses nothing. Today's "Add your first habit" button opens Habits and focuses the add input through `pendingFocus`. This supersedes the "Week section below the today list" and "Badges section below the Week section" layout above: Week is its own view, Badges render in the Today view.
- **Budget spend is computed, never stored:** `budgetStatus(habit, checkins, today)` = cost × the habit's check-ins dated in the current period (weekly = Mon–Sun, monthly = calendar month, local dates), in integer cents to avoid float drift; it returns `null` without both cost and budget. Amounts are text inputs (`.` or `,` decimal), valid when above 0, ≤ 999999.99, ≤ 2 decimals; shown with `Intl.NumberFormat(undefined)` and no currency symbol. A present but malformed `cost`/`budget` is corrupted in `parseHabits`; a stored budget without a cost is accepted but shows no summary. Over budget = ⚠️ icon + "Over budget by X".
- **Progress is computed, never stored:** `progress(habits, checkins, today, period)` (period 7 or 30, rolling, ending today) counts expected = scheduled and active days up to today, done = check-ins on those days only (an unscheduled check-in is ignored, so done ≤ expected). Habits without expected days show "No scheduled days" and are left out of the totals; percentages are rounded to whole numbers; overall per-day bars count habits. The period is local state in `ProgressView` (default 7, resets when the view is left). Charts are plain SVG with a hatched pattern for "expected" and a solid fill for "done", plus a visually hidden data table per chart; no charting library.
- **Reminders are computed, never stored:** `dueReminders(habits, checkins, today, time, dismissed)` = habits with a `reminderTime` ≤ the local "HH:mm" that are `checkable` today, not done and not dismissed today. `HabitList` keeps `time` in state (empty until mounted), refreshed by a 10 s interval plus the same focus/visibility/interaction refresh as `today`. Dismissals are an in-memory `Set` of `date|habitId` (reset on reload; a new date makes old keys irrelevant). The banner is `role="status"` with icon + text, no Notification API. A malformed `reminderTime` is corrupted in `parseHabits`; a missing one means no reminder.
- **Colours and spacing come from tokens:** CSS Modules use `var(--…)` from `tokens.css`; no hex or `rgb()` literals in any stylesheet (enforced by a test).
- **Modals are hand-written** (`DeleteDialog`: focus trap, Escape), not native `<dialog>`.
- Client components start with `"use client"` only where they need state or effects.
- Runtime dependencies are only `next`, `react`, `react-dom` (enforced by a test).
- No new runtime dependency without a reason in the PR description.

## Decisions

| ID  | Decision                                                                                                                                         | Since      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| A1  | Static export; no backend                                                                                                                        | foundation |
| A2  | Domain logic pure in `src/lib/`, storage behind one adapter                                                                                      | foundation |
| A3  | Vitest + Testing Library; tests named after acceptance criteria                                                                                  | foundation |
| A4  | TypeScript 5.9 (strict) until Next.js supports the native TypeScript 7 compiler                                                                  | foundation |
| A5  | One Node version (26) everywhere: `.nvmrc`, `engines`, CI, Vercel. Vercel deploys `main` and PR previews with default settings; no `vercel.json` | #12        |
