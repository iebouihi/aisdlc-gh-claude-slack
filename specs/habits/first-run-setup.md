---
id: habits/first-run-setup
title: First-run setup
module: habits
summary: A one-time setup screen on the very first visit that asks for an optional name and lets the user pick starter habits from a fixed list of 10; skippable and never shown again.
entities: [Profile, Habit]
status: active
issues: [67]
updated: 2026-11-22
---
# First-run setup

## Current behaviour
- On the very first load the app shows one setup screen before the app, with no nav. First load means none of `profile:v1`, `habits:v1` and `checkins:v1` exists and storage is readable.
- The screen has a labelled name field, a checkbox list of 10 common habits (icon and name, none preselected), a "Get started" button and a "Skip" option.
- The common habits are fixed in the code: Drink water, Walk, Read, Meditate, Sleep early, Stretch, Journal, Exercise, Healthy meal, No phone before bed. Each has a name and a catalog icon.
- The name is optional and follows `habits/user-profile` rules: trimmed, 1 to 30 characters, plain text. A name over 30 characters is not saved; an inline error is shown and announced and the setup stays open.
- Picking habits is optional (zero or more). Each picked habit becomes a normal Habit: its name and icon, Daily frequency, start date today (device local date), no end date, no cost, no budget. Habit rules of `habits/habit-management` apply.
- "Get started" saves the name (if any) in `profile:v1` and creates the picked habits. "Skip", or "Get started" with an empty name and nothing picked, saves no name and no habit. All three end on the Today view ("Welcome, <name>" or "Welcome"; empty state if no habit).
- Finishing or skipping stores a first-run-done flag in localStorage, so the setup never shows again, even if nothing else was saved. There is no way to reopen or reset it.
- Existing users (any of the three keys exists) never see the setup; no migration, existing data is untouched.
- If stored data is corrupted or storage is unavailable at load, no setup is shown; the existing non-blocking error appears and nothing is overwritten. If saving fails during setup, the same error is shown and the app continues for the session.
- The nav stays at three items (Today, Week, Habits); it is only hidden while the setup is shown. Later the name is edited in the Habits view and habits are added there.
- Accessibility: labelled name field, keyboard operable with visible focus, announced errors, WCAG 2.1 AA contrast, usable from 320px with no horizontal scroll, minimal style per `platform/ui-design-system`.
- Several tabs: last write wins.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | A one-time first-run setup asks for the name; the name stays editable inline in the Habits view afterwards | #67 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1795376169606549?thread_ts=1795376169.606549&cid=C0CDNGE90V7) |
| D2 | The name is skippable; picking habits is optional | #67 | same thread |
| D3 | One setup screen before the app, no nav until finished or skipped; shown only once, no reopen or reset | #67 | same thread |
| D4 | First load = none of `profile:v1`, `habits:v1`, `checkins:v1` exists; a first-run-done flag (key name left to the developer) prevents showing it again | #67 | same thread |
| D5 | Existing users never see it; no migration | #67 | same thread |
| D6 | Corrupted or unavailable storage: no setup, non-blocking error, no overwrite; save failure in setup: same error, continue for the session | #67 | same thread |
| D7 | Fixed list of 10 built-in habits, each with name and catalog icon | #67 | same thread |
| D8 | Picked habits become normal Habits: Daily, start today, no end date, no cost or budget | #67 | same thread |
| D9 | Name rules and storage as in `habits/user-profile` (`profile:v1`); no new key beyond the first-run-done flag | #67 | same thread |
| D10 | Checkbox list with icon and name, none preselected, "Get started" and "Skip"; AA contrast, keyboard, announced errors, 320px | #67 | same thread |

## Data
- Writes `Profile` (`name`) to `profile:v1`, owned by `habits/user-profile`.
- Writes `Habit` entries to `habits:v1`, owned by `habits/habit-management`.
- A first-run-done flag in localStorage (key name chosen by the developer).
- The list of 10 common habits is a constant in the code, not stored.

## Not covered
- Reopening or resetting the setup.
- Choosing frequency, dates, cost or budget in the setup.
- Editing or extending the common habit list.
- Setup for existing users or migration of existing data.
- Avatars, accounts or login.

## History
- 2026-11-22 #67: Created the capability (one-time first-run setup with optional name and starter habits from 10 common ones).
