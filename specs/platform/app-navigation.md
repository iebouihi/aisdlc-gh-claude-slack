---
id: platform/app-navigation
title: App navigation
module: platform
summary: A simple top or bottom nav with Today, Week and Habits on one page; switching views changes no URL path.
entities: []
status: active
issues: [27]
updated: 2026-11-01
---
# App navigation

## Current behaviour
- A simple top or bottom nav shows exactly three items: Today, Week and Habits.
- Selecting an item shows that view on the same page. The URL path does not change and the page does not reload. There are no new routes.
- Today holds the today list and check-in, Week holds the weekly overview, Habits holds habit management (add, edit, delete).
- The selected item is marked by more than colour and exposes `aria-current`. The nav is keyboard operable (Tab, Enter or Space) with a visible focus indicator.
- Existing behaviour of each view is unchanged (see `habits/daily-check-in`, `habits/weekly-overview`, `habits/habit-management`).
- Add a habit, check in and view the week take no more taps than before.
- The initial view on load and the placement of the discipline badges keep their behaviour from before this change.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | Navigation is a simple top or bottom nav with Today, Week and Habits. | #27 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793564182896619?thread_ts=1793564182.896619&cid=C0CDNGE90V7) |
| D2 | Everything stays on one page; no new routes or URL path changes. | #27 | same thread |
| D3 | The selected item is not shown by colour alone; the nav is keyboard operable with visible focus. | #27 | same thread |
| D4 | Navigation changes no existing rule of the views and adds no extra taps to the main flows. | #27 | same thread |

## Data
- Owns no stored data.

## Not covered
- New routes, deep links and browser history entries per view.
- Initial view on load and discipline badge placement (they keep today's behaviour).
- New features inside any view.

## History
- 2026-11-01 #27: Created the capability (Today / Week / Habits nav on one page, no routes).
