---
id: platform/theme-preference
title: Theme preference
module: platform
summary: The user picks System, Light or Dark in the Habits view; System follows the device setting live, the choice is stored in theme:v1 and applied before first paint.
entities: [ThemePreference]
status: active
issues: [41]
updated: 2026-11-04
---
# Theme preference

## Current behaviour
- The app has a light and a dark theme (see `platform/ui-design-system`).
- A labelled control inline in the Habits view, next to "Your name", offers three choices: System (default), Light, Dark. The current choice is shown by more than colour.
- With System, the app uses the device setting (`prefers-color-scheme`) and follows changes live, without a reload. If the browser cannot report it, Light is used.
- A first-time visitor with no saved choice gets System.
- The saved or system theme is applied before first paint by a tiny inline script, so the wrong theme never flashes.
- The choice is stored in `theme:v1`. `habits:v1`, `checkins:v1`, `badges:v1` and `profile:v1` are unchanged and need no migration.
- If `theme:v1` is corrupted or storage is unavailable, the app uses System, shows a non-blocking error and never crashes. Nothing is overwritten until the user changes the choice.
- The nav stays at Today, Week and Habits; no new route (see `platform/app-navigation`).
- Accessibility: labelled control, keyboard operable with visible focus, usable from 320px with no horizontal scroll.
- Several tabs: last write wins.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | Light and dark themes are supported; the theme follows the device setting by default and a manual toggle overrides it. | #41 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793804167913529?thread_ts=1793804167.913529&cid=C0CDNGE90V7) |
| D2 | The toggle has three choices: System (default), Light, Dark. | #41 | same thread |
| D3 | The toggle is inline in the Habits view next to "Your name"; the nav keeps three items and no route is added. | #41 | same thread |
| D4 | No saved choice: device theme; Light if the browser cannot report it. With System, device changes apply live. | #41 | same thread |
| D5 | The theme is applied before first paint by a tiny inline script; no flash of the wrong theme. | #41 | same thread |
| D6 | Stored in `theme:v1` as {mode: "system"\|"light"\|"dark"}; other keys unchanged, no migration. | #41 | same thread |
| D7 | Corrupted or unavailable `theme:v1`: fall back to System, non-blocking error, no crash, no overwrite until the user changes the choice. | #41 | same thread |
| D8 | The toggle is labelled and shows the selection by more than colour; no new runtime dependency. | #41 | same thread |

## Data
- Entity `ThemePreference`: `mode` ("system", "light" or "dark").
- localStorage key `theme:v1` holds the ThemePreference. When absent, the mode is System.

## Not covered
- Scheduled auto dark at night.
- More than two themes.
- Syncing the choice across devices.
- The exact wording of the storage error message.

## History
- 2026-11-04 #41: Created the capability (System/Light/Dark choice, `theme:v1`, no-flash script, fallback).
