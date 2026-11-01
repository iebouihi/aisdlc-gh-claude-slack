---
id: habits/user-profile
title: User profile and welcome
module: habits
summary: An optional user name set inline in the Habits view, shown in a welcome heading on the Today view with the emoji and name of the most recently earned badge; stored in the browser's localStorage.
entities: [Profile]
status: active
issues: [30]
updated: 2026-11-01
---
# User profile and welcome

## Current behaviour
- The Habits view has an inline "Your name" control. The user can set, edit (Save or Cancel) and remove the name. Clearing the field and choosing Save removes the name.
- The name is optional. The app never prompts for it on first visit and never blocks on it.
- Name rules: trimmed, 1 to 30 characters, any text. It is rendered as plain text, never as HTML. A name longer than 30 characters is not saved and an inline error is shown and announced.
- The Today view starts with a welcome heading: "Welcome, <name>", or "Welcome" when there is no name.
- Next to the welcome, the emoji and the name of the most recently earned badge are shown (e.g. "🌱 Steady 3"). "Most recent" is by earned date; on a tie, the badge furthest along the badge order (First Step, Steady 3, Week Warrior, Fortnight Focus, Iron Discipline). No badge earned: no icon.
- The icon is computed when the app loads, so a badge earned during a visit appears there on the next visit (page load or app reopen), like the "New" label in `habits/discipline-badges` D12. No toast, no animation, and the icon has no "New" label of its own.
- The badge name is always shown as text next to the emoji; the emoji alone never carries the state.
- The name is stored in `profile:v1`. `habits:v1`, `checkins:v1` and `badges:v1` are unchanged and need no migration.
- If `profile:v1` is corrupted or storage is unavailable at load, a non-blocking error is shown, the welcome has no name, and the app never crashes. Nothing is overwritten until the user saves.
- The nav is unchanged (Today, Week, Habits); see `platform/app-navigation`.
- Accessibility: WCAG 2.1 AA contrast, keyboard operable with visible focus, a labelled name field, error messages announced, usable from 320px with no horizontal scroll. Minimal style per `platform/ui-design-system`.
- Several tabs: last write wins.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | The name is set and edited inline in the Habits view; the nav stays at exactly three items (`platform/app-navigation` D1 unchanged) | #30 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793572695958959?thread_ts=1793572695.958959&cid=C0CDNGE90V7) |
| D2 | The welcome is a heading at the top of the Today view: "Welcome, <name>" or "Welcome" | #30 | same thread |
| D3 | The icon is the emoji of the most recently earned badge, shown with the badge name as text; no icon if none is earned | #30 | same thread |
| D4 | The name is optional; no prompt, no blocking | #30 | same thread |
| D5 | Name: trimmed, 1 to 30 characters, any text, plain text only; an empty save clears it | #30 | same thread |
| D6 | Edit action with Save and Cancel; clear and Save removes the name | #30 | same thread |
| D7 | Most recent badge by earned date; on a tie, the one furthest along the badge order | #30 | same thread |
| D8 | The icon updates on the next visit, like `habits/discipline-badges` D12; no toast, animation or own "New" label | #30 | same thread |
| D9 | Stored in `profile:v1` as {name}; `habits:v1`, `checkins:v1`, `badges:v1` unchanged, no migration | #30 | same thread |
| D10 | Corrupted or unavailable `profile:v1`: non-blocking error, welcome without name, no crash, no overwrite until the user saves | #30 | same thread |
| D11 | Minimal style; the badge name is text next to the emoji; AA contrast, keyboard operable with visible focus, labelled field, announced errors, usable from 320px | #30 | same thread |

## Data
- Entity `Profile`: `name` (string, trimmed, 1 to 30 characters). When no name is set, there is no name value.
- localStorage key `profile:v1` holds the Profile.
- Reads earned `Badge` from `badges:v1` (owned by `habits/discipline-badges`).

## Not covered
- Avatars or photo uploads.
- Accounts or login.
- Name sync across devices.
- Time-based greetings (e.g. "Good morning").
- A choice of icon.
- A new nav item or route for the profile.
- The exact wording of the too-long-name error message.

## History
- 2026-11-01 #30: Created the capability (optional user name, welcome heading on Today, latest earned badge icon, `profile:v1`).
