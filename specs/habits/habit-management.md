---
id: habits/habit-management
title: Habit management
module: habits
summary: Create, list, edit and delete habits with a name, optional catalog icon, frequency, start/end dates and optional cost and budget; stored only in the browser's localStorage.
entities: [Habit]
status: active
issues: [1, 15, 2, 33, 47]
updated: 2026-11-09
---
# Habit management

## Current behaviour
- A Habit has a name, an optional icon chosen from a fixed built-in catalog, a frequency, a start date, an optional end date, an optional cost and an optional budget. The app is static Next.js, with no backend and no login.
- An add input is always visible at the top of the list, with an icon picker and a visible "Add" button next to it. Enter or "Add" saves the new habit with the same validation, and clears the input. No toast is shown.
- The icon is optional. A habit without a valid icon shows a neutral default icon. The catalog is about 24 built-in emoji icons shipped in the code; there are no uploads and no network calls.
- The picker is also available when editing a habit. It is fully keyboard-operable and each option has a text label. In the list the icon is decorative and the habit name is the accessible name.
- Frequency is required: "Daily" (preselected for a new habit) or specific weekdays (one or more of Mon–Sun). There are no "N times per week", monthly or custom intervals.
- The start date is required and defaults to today (the device's local date). The end date is optional; empty means the habit never ends.
- A new habit's start date must be today or later, and the end date must be on or after the start date. Errors: "Start date can't be in the past." and "End date must be on or after the start date."
- When editing, the past-date rule applies only when the start date is changed or set; an unchanged past start date stays valid. A changed end date must be today or later.
- "Today" is the device's local date, with no server check. A changed device clock can bypass the rules.
- Cost is optional: a fixed amount per check-in. Budget is optional: an amount plus a period, "Weekly" or "Monthly". Amounts are positive numbers with at most 2 decimals, up to 999999.99, with inline errors. A budget without a cost is not allowed. Spend and the budget summary are described in `habits/habit-budget`.
- The frequency, date, cost and budget inputs are in the add form and the inline edit form, next to the name: native date inputs, a weekday checkbox group and amount inputs. They are labelled, errors are announced, and they are keyboard-operable and usable from 320px.
- The add form and the inline edit form share one compact layout. Text, date and amount inputs have the same height (about 40px), font size, border and radius, from the design tokens. Fields are in short groups (name + icon, schedule, cost and budget), with labels above the inputs and the same gap between fields. Start and end dates sit side by side from about 480px width and are stacked below. Cost is on one row; budget amount and period are on one row that wraps on narrow screens. Controls are at least 40px high. Small native date-input differences between browsers are accepted.
- Each row shows a short schedule summary, e.g. "Daily · from 12 Nov" or "Mon, Wed, Fri · 12 Nov – 12 Dec", and, when the habit has a budget, the budget summary from `habits/habit-budget`.
- When the end date has passed, the habit stays in the list, shown as "Ended" with its end date. It is not deleted or hidden. The schedule is used by `habits/daily-check-in` to decide whether a habit can be checked today.
- A habit stored without frequency or dates is treated as Daily, starting on its `createdAt` date, with no end date. A habit stored without cost or budget simply has none. There is no migration and it is not corrupted.
- The list shows habits in creation order, oldest first. New habits appear at the bottom. Habits cannot be reordered.
- Names are trimmed and must be 1 to 60 characters, counted as Unicode characters (an emoji counts as 1). The input has no maxlength attribute, so pasted over-long text still shows the error.
- Inline errors: empty "Enter a habit name."; over 60 characters "Name must be 60 characters or fewer."; duplicate "You already have this habit."
- Duplicates are compared after trimming and case-folding only. Inner whitespace is kept as typed. When editing, the habit being edited is ignored in the check.
- Each row is edited inline, with text buttons "Edit" and "Delete" whose accessible names include the habit name. Enter saves and Escape cancels. Only one row is editable at a time. Starting another edit or clicking away cancels the current edit and keeps the original values.
- Saving an edit with an unchanged name (or one changed only by case or spacing) is allowed: it closes with no error and the trimmed name is saved.
- Editing never changes `id`, `createdAt` or the habit's position in the list.
- Delete asks for confirmation in a dialog. Deletion is permanent, with no undo, and also deletes the habit's check-ins (see `habits/daily-check-in`). Opening the dialog while a row is being edited cancels that edit (original values kept). The dialog traps focus, Escape cancels, and focus returns to the row's Delete button on cancel.
- Empty state shows "No habits yet" and a prominent "Add your first habit" button. The button focuses the add input.
- Nothing is rendered in the list until storage has been read on the client, so the empty state never flashes.
- If stored data is corrupted or localStorage is unavailable at load, a non-blocking error message is shown and the list starts empty. Valid JSON with a malformed entry (missing id or name, name over 60 characters, or a present but malformed `frequency`, `startDate`, `endDate`, `cost` or `budget`) counts as corrupted. A missing or unknown `icon`, or missing `frequency`, `startDate`, `cost` and `budget`, does not. The app never crashes. Corrupted data is not overwritten until the user saves a change.
- If saving fails after load, the same non-blocking error is shown and the change stays visible for the current session.
- Focus: after a delete it moves to the next habit's row, or to the add input if the list is empty. After an edit is saved or cancelled it returns to that row's edit button.
- Accessibility: everything is keyboard-operable, with labelled inputs, visible focus, errors announced to screen readers, and WCAG 2.1 AA contrast.
- Layout and support: usable from 320px width up with no horizontal scroll, on the latest two versions of Chrome, Firefox, Safari and Edge.
- Several tabs: last write wins.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| ~~D1~~ | ~~A habit has a name only; no description, target, frequency, color or icon~~ → superseded by D26 (#1) | #1 | Slack thread |
| D2 | Marking done, tracking and streaks are separate requirements (marking done today: `habits/daily-check-in`) | #1 | Slack thread |
| D3 | Name is trimmed, 1–60 characters; empty shows an inline error and nothing is saved | #1 | Slack thread |
| D4 | No duplicate names (trimmed, case-insensitive); error "You already have this habit." | #1 | Slack thread |
| D5 | No hard limit on the number of habits | #1 | Slack thread |
| D6 | Delete needs a confirmation dialog; permanent, no undo | #1 | Slack thread |
| D7 | Empty state: "No habits yet" and a prominent "Add your first habit" button | #1 | Slack thread |
| D8 | Stored in localStorage under one versioned key; each habit has id, name, createdAt (and optional icon, see D30) | #1 | Slack thread |
| D9 | Corrupted data or unavailable storage: non-blocking error, empty list, no crash, no overwrite until the user saves | #1 | Slack thread |
| D10 | Creation order, oldest first; no reordering | #1 | Slack thread |
| D11 | Add via input at the top; edit inline; Enter saves, Escape cancels (a visible "Add" button is also available, see D37) | #1 | Slack thread |
| D12 | List updates immediately after saving; no toast | #1 | Slack thread |
| D13 | Keyboard-operable, labelled inputs, visible focus, announced errors, WCAG 2.1 AA contrast | #1 | Slack thread |
| D14 | Multiple tabs: last write wins; export/import is a future requirement | #1 | Slack thread |
| D15 | D1–D14 confirmed as written | #1 | Slack thread |
| D16 | Duplicate check ignores the habit being edited | #1 | Slack thread |
| D17 | Duplicate check only trims and case-folds; inner whitespace kept | #1 | Slack thread |
| D18 | One editable row at a time; a new edit or clicking away cancels the current edit | #1 | Slack thread |
| D19 | Save failure after load: same non-blocking error, change kept for the session, no crash | #1 | Slack thread |
| D20 | "Add your first habit" focuses the add input; the input is always visible | #1 | Slack thread |
| ~~D21~~ | ~~id from crypto.randomUUID() with fallback; key `habits:v1` holds [{id, name, createdAt ISO 8601}]~~ → superseded by D30 (#1) | #1 | Slack thread |
| D22 | Error messages "Enter a habit name." and "Name must be 60 characters or fewer."; no maxlength on the input | #1 | Slack thread |
| D23 | Focus after delete goes to the next row or the add input; after save or cancel to the row's edit button | #1 | Slack thread |
| D24 | Render nothing in the list until storage is read; no empty-state flash | #1 | Slack thread |
| D25 | Last write wins across tabs accepted; revisit with export/import | #1 | Slack thread |
| ~~D26~~ | ~~A habit has a name and an optional icon (thumbnail); no description, target, frequency or color~~ → superseded by D41 (#15) | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D27 | Icon catalog: fixed set of about 24 built-in emoji icons shipped in the code; no uploads, no network calls | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D28 | Icon is optional; no icon shows a neutral default icon; name rules unchanged | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D29 | Icon picker sits next to the name input, when adding and when editing | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| ~~D30~~ | ~~id from crypto.randomUUID() with fallback; key `habits:v1` holds [{id, name, createdAt ISO 8601, icon?}]; no migration; missing or unknown `icon` = no icon, not corrupted (D9)~~ → superseded by D48 (#15) | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D31 | Picker is keyboard-operable, options have text labels; in the list the icon is decorative and the name is the accessible name | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D32 | The 60-character limit counts Unicode characters (code points); an emoji counts as 1 | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D33 | Saving an edit with an unchanged name (or changed only by case or spacing) is allowed: no error, trimmed name saved | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D34 | Opening the delete dialog cancels an open edit (original name kept); the dialog applies to the chosen habit | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D35 | Editing never changes `id`, `createdAt` or list position | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| ~~D36~~ | ~~Valid JSON with a malformed entry (missing id or name, or name over 60) is treated as corrupted under D9~~ → superseded by D49 (#15) | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D37 | A visible "Add" button next to the input behaves like Enter, with the same validation | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D38 | Text buttons "Edit" and "Delete" with accessible names including the habit name; delete dialog traps focus, Escape cancels, focus returns to the row's Delete button on cancel | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D39 | Usable from 320px width up with no horizontal scroll; latest two versions of Chrome, Firefox, Safari and Edge | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| ~~D40~~ | ~~Removing check-ins when a habit is deleted is out of scope here; `id` stays stable for the future tracking requirement~~ → superseded by D53 (#2) | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| ~~D41~~ | ~~A habit has a name, optional icon, frequency, start date and optional end date; still no description, target or color~~ → superseded by D54 (#33) | #15 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793451088642969?thread_ts=1793451088.642969&cid=C0CDNGE90V7) |
| D42 | Frequency is required: Daily (preselected) or specific weekdays (one or more of Mon–Sun); no "N times per week", monthly or custom intervals | #15 | same thread |
| D43 | Start date is required and defaults to today (local date); end date is optional, empty means never ends | #15 | same thread |
| D44 | New habit: start date today or later, end date on or after start date; errors "Start date can't be in the past." and "End date must be on or after the start date." | #15 | same thread |
| D45 | Editing: the past-date rule applies only when the start date is changed or set; an unchanged past start date stays valid; a changed end date must be today or later | #15 | same thread |
| D46 | After the end date passes the habit stays in the list as "Ended" with its end date; not deleted or hidden; nothing else changes | #15 | same thread |
| D47 | Habits without frequency or dates: no migration; treated as Daily from their `createdAt` date, no end date; not corrupted (D9) | #15 | same thread |
| ~~D48~~ | ~~id from crypto.randomUUID() with fallback; key `habits:v1` holds [{id, name, createdAt ISO 8601, icon?, frequency?, startDate?, endDate?}]; …~~ → superseded by D57 (#33) | #15 | same thread |
| ~~D49~~ | ~~Valid JSON with a malformed entry (missing id or name, name over 60, or a present but malformed `frequency`, `startDate` or `endDate`) is treated as corrupted under D9~~ → superseded by D58 (#33) | #15 | same thread |
| D50 | Frequency and date inputs sit in the add form and the inline edit form next to the name: native date inputs and a weekday checkbox group; each row shows a short summary such as "Daily · from 12 Nov" or "Mon, Wed, Fri · 12 Nov – 12 Dec" | #15 | same thread |
| D51 | New inputs are labelled, errors announced to screen readers, keyboard-operable, usable from 320px with no horizontal scroll | #15 | same thread |
| D52 | "Today" is the device's local date with no server check; a changed clock can bypass the date rules and that is accepted | #15 | same thread |
| D53 | Deleting a habit also deletes its check-ins, so no orphaned data remains (check-ins: `habits/daily-check-in`) | #2 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793532079551769?thread_ts=1793532079.551769&cid=C0CDNGE90V7) |
| D54 | A habit has a name, optional icon, frequency, start date, optional end date, optional cost and optional budget; still no description or color | #33 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793612645519089?thread_ts=1793612645.519089&cid=C0CDNGE90V7) |
| D55 | Cost is optional and a fixed amount per check-in; budget is optional (amount + period "Weekly" or "Monthly"); one budget per habit, no global budget; amounts are positive, max 2 decimals, max 999999.99; a budget without a cost is not allowed; errors inline | #33 | same thread |
| D56 | Cost and budget inputs sit in the add form and the inline edit form; they follow D13 and D51 (labelled, announced errors, keyboard, 320px); the summary is in the habit row only (see `habits/habit-budget`) | #33 | same thread |
| D57 | id from crypto.randomUUID() with fallback; key `habits:v1` holds [{id, name, createdAt ISO 8601, icon?, frequency?, startDate?, endDate?, cost?, budget?}]; `frequency` is {type:"daily"} or {type:"weekdays", days:[0–6]}; `startDate` and `endDate` are local dates "YYYY-MM-DD"; `cost` is a number; `budget` is {amount: number, period: "weekly"\|"monthly"}; missing or unknown `icon` = no icon; missing `frequency` or `startDate` = see D47; missing `cost` or `budget` = none; no migration | #33 | same thread |
| D58 | Valid JSON with a malformed entry (missing id or name, name over 60, or a present but malformed `frequency`, `startDate`, `endDate`, `cost` or `budget`) is treated as corrupted under D9 | #33 | same thread |
| D59 | The add form and the inline edit form share one compact layout, visual only (rules, messages and data unchanged): equal-size inputs (about 40px high), short groups with labels above, start and end dates side by side from about 480px and stacked below, cost and budget (amount + period) on compact rows, controls at least 40px high; native date inputs kept; small native browser differences accepted | #47 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1794261755875149?thread_ts=1794261755.875149&cid=C0CDNGE90V7) |

## Data
- Entity `Habit`: `id` (string, from crypto.randomUUID() or a fallback), `name` (string, trimmed, 1–60 Unicode characters), `createdAt` (ISO 8601 string), `icon` (optional string, the id of a built-in catalog icon; missing or unknown means no icon), `frequency` (`{type:"daily"}` or `{type:"weekdays", days:[0–6]}`; missing means Daily), `startDate` (local date "YYYY-MM-DD"; missing means the `createdAt` date), `endDate` (optional local date "YYYY-MM-DD"; missing means no end), `cost` (optional number > 0, at most 2 decimals, max 999999.99; amount per check-in), `budget` (optional `{amount, period}`; `amount` as for `cost`, `period` is "weekly" or "monthly"; only present together with `cost`).
- localStorage key `habits:v1` holds an array of Habit in creation order.

## Not covered
- Habit fields other than name, icon, frequency, start date, end date, cost and budget.
- Frequencies such as "N times per week", monthly or custom intervals.
- Uploaded, custom or network-loaded icons.
- Marking done today is in `habits/daily-check-in`; history views, streaks and reminders are not covered.
- Spend calculation and display are in `habits/habit-budget`; currency, global budget and cost history are not covered.
- Hiding, archiving or deleting habits automatically when they end.
- Server-side date checks or protection against a changed device clock.
- Reordering and undo of deletion.
- Toast or other save feedback.
- Export and import.
- Cross-tab syncing or merging.
- Normalising inner whitespace in names.
- A custom date picker (native date inputs are kept) or pixel-identical rendering across browsers.

## History
- 2026-10-30 #1: Created the capability (create, list, edit and delete habits, stored in localStorage).
- 2026-10-30 #1: Added an optional catalog icon (D26–D31; D1 and D21 superseded), a visible "Add" button, and edge-case, data and UX rules (D32–D40).
- 2026-10-31 #15: Added frequency (daily or weekdays), start date and optional end date with date rules, "Ended" display and legacy handling (D41–D52; D26, D30 and D36 superseded).
- 2026-11-01 #2: Deleting a habit now also deletes its check-ins (D53; D40 superseded); the schedule is now used by daily check-in.
- 2026-11-02 #33: Added optional cost and budget fields with validation, storage and corruption rules (D54–D58; D41, D48 and D49 superseded); budget display is in `habits/habit-budget`.
- 2026-11-09 #47: Add and edit forms now share a compact, grouped layout with equal-size inputs and side-by-side dates (D59); visual only.
