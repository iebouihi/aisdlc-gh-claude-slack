---
issue: 67
title: Init app data (first-run setup)
specs: [habits/first-run-setup, habits/user-profile, habits/habit-management, platform/app-navigation, platform/app-foundation, habits/daily-check-in]
decisions: [TD16, TD17, TD18, TD2, TD3, TD5]
mockup: mockup.html
status: proposed
updated: 2026-11-22
---
# Technical design: #67 Init app data (first-run setup)

## Approach
`HabitList` already reads every storage key in its load effect and owns all data state (A2, TD4). The load effect also decides whether this is a first run: the three data keys and a new `setup:v1` flag must all be readable and empty. If so, `HabitList` renders a new `FirstRunSetup` component instead of the nav and the views. Finishing or skipping goes through the same `persist*` helpers as the rest of the app, so save failures reuse the existing non-blocking errors and the session keeps the data (AC11). The rules (the list of 10, first-run detection, building the habits) are pure functions in a new `src/lib/firstRun.ts`. Starter habits are created with the existing `addHabit`, so they are normal habits (AC14). The flag is a new key `setup:v1` (TD2), not a field in `profile:v1`, because an empty skip must not create a profile (AC6, AC7).

## Technical decisions
| ID | Decision | Reason | Status |
|---|---|---|---|
| TD16 | First run = `habits:v1`, `checkins:v1`, `profile:v1` and `setup:v1` all read as OK and missing (`ok: true, value: null`). Any read failure (corrupted or unavailable) or any present key means no setup | one rule covers new, existing and broken storage (D6, D7, D8) without writing anything at load | new |
| TD17 | The first-run-done flag is its own key `setup:v1` = `{"done": true}`, written on finish and skip (`SETUP_KEY` in `storage.ts`) | a skip with nothing saved has no other record; follows TD2 (new entity, own key) | new |
| TD18 | The 10 starter habits are a constant `STARTER_HABITS` (`{id, name, icon}`) in `src/lib/firstRun.ts`; `icon` is a catalog id; one catalog icon is added for "Stretch" | fixed list in code (D9); ids are stable for tests and checkbox keys | new |

## Modules and files
| Module (code map) | File | Change |
|---|---|---|
| Storage helper | `src/lib/storage.ts` | add `SETUP_KEY = "setup:v1"` |
| First-run domain (new) | `src/lib/firstRun.ts` | new, pure: `STARTER_HABITS` (10, in the order of D9), `isFirstRun(results: StorageResult<unknown>[])` (TD16), `parseSetup(value)` (`{done: true}` valid), `starterHabits(habits, selectedIds, now)` returns the habits with each selected starter added in list order via `addHabit` (name, icon, default Daily schedule starting `toLocalDate(now)`, no end, no money) |
| Habit domain | `src/lib/icons.ts` | add `{ id: "stretch", emoji: "🤸", label: "Stretch" }` to `ICON_CATALOG` (25 icons). Other starters reuse: water, walk, book, meditate, sleep, write (Journal), workout (Exercise), salad (Healthy meal), phone |
| First-run UI (new) | `src/components/FirstRunSetup.tsx` | new form: name field, checkbox list, "Get started", "Skip". Props `onFinish(name: string, selectedIds: string[])`, `onSkip()` |
| Habit UI | `src/components/HabitList.tsx` | load effect computes `firstRun` (state, `false` until loaded); when true, return `<FirstRunSetup>` only (no `AppNav`, no views, no storage-error banners other than save errors); add `finishSetup`, `skipSetup` |
| Habit UI | `src/components/HabitList.module.css` | classes for the setup screen (reuse `.input`, `.button`, `.primaryButton`, `.storageError`) |
| Code map | `app/ARCHITECTURE.md` | developer updates: module row, icon count, `setup:v1` |

`HabitList` changes in detail:
- Load effect: keep the existing reads; collect the `readJson` results of `HABITS_KEY`, `CHECKINS_KEY`, `PROFILE_KEY` and a new read of `SETUP_KEY`; `setFirstRun(isFirstRun([...]))`. Nothing is written at load for a first run (the existing badge write only happens when badges were earned, which needs habits, so it cannot happen here).
- `finishSetup(name, ids)`: `const checked = validateProfileName(name)` is done inside `FirstRunSetup` (so the error stays in the form, AC3). Then: if `ids.length > 0` → `persist(starterHabits(habits, ids, new Date()))`; if the name is not empty → `saveProfileName(name)`; always → `writeJson(SETUP_KEY, {done: true})` (a failure sets `storageError` through the same flag as habits, the same message); `setFirstRun(false)`; `setView("today")`; focus the welcome heading through `pendingFocus`.
- `skipSetup()`: write only the flag, then `setFirstRun(false)`.
- Today's `today` state is set in the load effect before `loaded`, so `starterHabits` uses the same local date (TD5) and nothing date-dependent is in the static build.

## Impact on existing features
| Feature (spec) | Impact (from the issue) | Modules / components touched | Existing tests to update or keep |
|---|---|---|---|
| `habits/user-profile` | changes (AC1, AC4–AC7, AC13): the name is also asked once in the setup | `FirstRunSetup.tsx`, `HabitList.tsx`; `ProfileName.tsx`, `profile.ts` unchanged (reused) | `HabitList.profile.test.tsx`: tests seed storage or mock an existing key; a test that asserts "never prompted for the name" becomes AC1 (#67), see below |
| `habits/habit-management` | keeps working (AC14) | none (`addHabit`, `validateName` reused) | `habits.test.ts` icon-catalog length test (24) changes to 25 because of "Stretch"; others unchanged |
| `platform/app-navigation` | keeps working (AC5) | `AppNav` unchanged, only not rendered during setup | `HabitList.nav.test.tsx` unchanged after seeding |
| `platform/app-foundation` | keeps working (AC10, AC11) | `storage.ts` gets one constant; `readJson`/`writeJson` unchanged | `storage.test.ts` unchanged |
| `habits/daily-check-in` | keeps working (AC14) | none | `HabitList.checkin.test.tsx` unchanged after seeding |

**Test impact:** every existing component test and e2e test renders `HabitList` with empty storage, which is now a first run. They must seed a key (or `setup:v1` = `{"done":true}`) before rendering: do it once in `test-utils.tsx` (`renderView`) and in the e2e `app` fixture (`e2e/support`), not in each test. This is a consequence of the `changes` row, not a weakening of any test. The e2e `app` fixture needs one extra option, `firstRun: true`, to start with empty storage for the #67 tests.

## Data and storage
- New key `setup:v1` = `{"done": true}`. Valid when it is an object with `done === true`. Corrupted JSON, or any other shape, means "read failed" for TD16: no setup, the error banner is not shown for this key alone (it carries no user data) and nothing is overwritten.
- `profile:v1` is written only when the trimmed name is not empty (`{name: "Sara"}`); `habits:v1` only when at least one starter is picked. A skip or an empty "Get started" writes only `setup:v1` (AC6, AC7, AC8).
- Created habits are normal entries: `{id, name, createdAt, icon, frequency: Daily, startDate: today}`, no `endDate`, `cost`, `budget`, `category` or `reminderTime` (AC4).
- No migration: existing users have at least one key (AC9) and never get `setup:v1` written. Their data is unchanged.
- Clearing only `setup:v1` while the other keys are missing shows the setup again (accepted risk of the requirement).

## State and components
- `HabitList` owns `firstRun: boolean` (session state, initial `false`, set in the load effect, never stored). The existing `loaded` guard still prevents any flash: nothing renders before `loaded`.
- `FirstRunSetup` owns the draft only: `name` (string), `selected` (`Set` of starter ids, empty at start), `error` (string or null). It checks the name with `validateProfileName` on submit; an error keeps the screen open and nothing is saved (AC3).
- Tree when `firstRun`: `main` → `FirstRunSetup` → `h1` "Welcome to Good Habit Tracker" + short text → `form` → name `label` + `input` + error `p role="alert"` → `fieldset` (`legend` "Pick starter habits (optional)") with 10 `label` + checkbox rows → buttons "Get started" (primary, submit) and "Skip" (`type="button"`). `AppNav`, `ProfileName`, views and add form are not rendered.
- A failed save during the setup shows the existing `storageError` or `profileError` alert (shown after the setup closes, on Today) and the habits and name stay in state for the session (AC11).

## Acceptance criteria → design
| AC | Design element | Test (where) |
|---|---|---|
| AC1 | `isFirstRun` (TD16) + `firstRun` branch in `HabitList`, no `AppNav` | unit `firstRun.test.ts`; component `HabitList.firstrun.test.tsx`; e2e |
| AC2 | `FirstRunSetup` markup, `STARTER_HABITS` (10, order and names of D9), none checked (mockup: "First run") | unit (list); component |
| AC3 | `validateProfileName` in `FirstRunSetup`, error `role="alert"` tied to the input by `aria-describedby`, no `finishSetup` call (mockup: "Name too long") | component; e2e |
| AC4 | `finishSetup`, `starterHabits` via `addHabit`, `saveProfileName` | unit (`starterHabits`: fields, order, local date); component (storage content) |
| AC5 | Today view after `setView("today")`, existing welcome heading, `AppNav` rendered again (mockup: "After setup") | component; e2e |
| AC6 | `finishSetup` with empty name and no ids writes only `setup:v1` | component (storage has only `setup:v1`) |
| AC7 | `skipSetup` writes only `setup:v1` | component; e2e |
| AC8 | `setup:v1` present on reload → `isFirstRun` false | unit; e2e (reload) |
| AC9 | any of the three keys present → `isFirstRun` false; nothing written | unit; component (storage unchanged) |
| AC10 | any failed read → `isFirstRun` false; existing error banners | unit; component (corrupted and throwing storage) |
| AC11 | `persist`/`saveProfileName`/flag write failures reuse existing alerts; state keeps the data | component (mock `setItem` throwing) |
| AC12 | semantic form, `.input` focus style, 320px layout (mockup: mobile frames) | e2e (keyboard, 320px, axe) |
| AC13 | `ProfileName` and Habits view unchanged; no reopen control exists | component; e2e |
| AC14 | starters are plain habits from `addHabit`; same edit, delete, check-in code paths | component (edit, delete, check in a starter habit) |

## UI
- Mockup: `mockup.html`, states: First run (mobile and desktop) · AC1, AC2, AC12; Name too long · AC3; Some habits checked with a name · AC4; After setup, Today with "Welcome, Sara" · AC5; After skip, "Welcome" and empty state · AC6, AC7; Storage error after saving · AC11. Texts are the real ones; the new screen title, intro line and legend are design proposals (see Open questions).
- Accessibility: name `label` + `input` with `aria-invalid` and `aria-describedby` on error; error `role="alert"`; the habits are a `fieldset` + `legend` of native checkboxes (icon `aria-hidden`, the name is the label); Enter in the name field submits "Get started"; on load the name field is focused; after finishing or skipping, focus moves to the Today heading (`tabIndex={-1}`, via `pendingFocus`); visible focus uses the existing 2px accent outline; layout is a single column, no fixed width, so 320px has no horizontal scroll.

## Risks and trade-offs
- Every existing test now starts from a first run; seeding in `test-utils.tsx` and the e2e fixture keeps the change in two places.
- A user whose browser blocks storage never sees the setup (D8), which is intended.
- Adding the "Stretch" icon changes the catalog size (24 → 25) in a test and the code map.
- A new key adds one more storage read at load; negligible.
- Saving the flag can fail while habits were saved: the setup shows again on the next load but the habits key then exists, so it does not (TD16). Only a total failure repeats the setup.

## Open questions
- The code has four nav items (Today, Week, Progress, Habits) while `platform/app-navigation` D1 and AC5 say "exactly Today, Week and Habits". This design leaves `AppNav` untouched and AC5 tests "the nav is back and unchanged". Recommended: the reviewer confirms; the tester asserts the real items, and the specs are fixed through a separate refinement.
- The screen title ("Welcome to Good Habit Tracker"), intro line and fieldset legend are not in the requirement. Recommended: keep them as drafted, minimal.
- Habit icons: "Healthy meal" uses 🥗 and "Journal" uses ✍️ from the existing catalog; "Stretch" needs a new 🤸. Recommended: accept.
