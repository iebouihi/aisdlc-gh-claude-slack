---
id: habits/habit-management
title: Habit management
module: habits
summary: Create, list, edit and delete habits by name with an optional catalog icon; stored only in the browser's localStorage.
entities: [Habit]
status: active
issues: [1]
updated: 2026-10-30
---
# Habit management

## Current behaviour
- A Habit has a name and an optional icon chosen from a fixed built-in catalog. The app is static Next.js, with no backend and no login.
- An add input is always visible at the top of the list, with an icon picker and a visible "Add" button next to it. Enter or "Add" saves the new habit with the same validation, and clears the input. No toast is shown.
- The icon is optional. A habit without a valid icon shows a neutral default icon. The catalog is about 24 built-in emoji icons shipped in the code; there are no uploads and no network calls.
- The picker is also available when editing a habit. It is fully keyboard-operable and each option has a text label. In the list the icon is decorative and the habit name is the accessible name.
- The list shows habits in creation order, oldest first. New habits appear at the bottom. Habits cannot be reordered.
- Names are trimmed and must be 1 to 60 characters, counted as Unicode characters (an emoji counts as 1). The input has no maxlength attribute, so pasted over-long text still shows the error.
- Inline errors: empty "Enter a habit name."; over 60 characters "Name must be 60 characters or fewer."; duplicate "You already have this habit."
- Duplicates are compared after trimming and case-folding only. Inner whitespace is kept as typed. When editing, the habit being edited is ignored in the check.
- Each row is edited inline, with text buttons "Edit" and "Delete" whose accessible names include the habit name. Enter saves and Escape cancels. Only one row is editable at a time. Starting another edit or clicking away cancels the current edit and keeps the original name.
- Saving an edit with an unchanged name (or one changed only by case or spacing) is allowed: it closes with no error and the trimmed name is saved.
- Editing never changes `id`, `createdAt` or the habit's position in the list.
- Delete asks for confirmation in a dialog. Deletion is permanent, with no undo. Opening the dialog while a row is being edited cancels that edit (original name kept). The dialog traps focus, Escape cancels, and focus returns to the row's Delete button on cancel.
- Empty state shows "No habits yet" and a prominent "Add your first habit" button. The button focuses the add input.
- Nothing is rendered in the list until storage has been read on the client, so the empty state never flashes.
- If stored data is corrupted or localStorage is unavailable at load, a non-blocking error message is shown and the list starts empty. Valid JSON with a malformed entry (missing id or name, or name over 60 characters) counts as corrupted. A missing or unknown `icon` does not. The app never crashes. Corrupted data is not overwritten until the user saves a change.
- If saving fails after load, the same non-blocking error is shown and the change stays visible for the current session.
- Focus: after a delete it moves to the next habit's row, or to the add input if the list is empty. After an edit is saved or cancelled it returns to that row's edit button.
- Accessibility: everything is keyboard-operable, with labelled inputs, visible focus, errors announced to screen readers, and WCAG 2.1 AA contrast.
- Layout and support: usable from 320px width up with no horizontal scroll, on the latest two versions of Chrome, Firefox, Safari and Edge.
- Several tabs: last write wins.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| ~~D1~~ | ~~A habit has a name only; no description, target, frequency, color or icon~~ → superseded by D26 (#1) | #1 | Slack thread |
| D2 | Marking done, tracking and streaks are separate requirements | #1 | Slack thread |
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
| D26 | A habit has a name and an optional icon (thumbnail); no description, target, frequency or color | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D27 | Icon catalog: fixed set of about 24 built-in emoji icons shipped in the code; no uploads, no network calls | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D28 | Icon is optional; no icon shows a neutral default icon; name rules unchanged | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D29 | Icon picker sits next to the name input, when adding and when editing | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D30 | id from crypto.randomUUID() with fallback; key `habits:v1` holds [{id, name, createdAt ISO 8601, icon?}]; no migration; missing or unknown `icon` = no icon, not corrupted (D9) | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D31 | Picker is keyboard-operable, options have text labels; in the list the icon is decorative and the name is the accessible name | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D32 | The 60-character limit counts Unicode characters (code points); an emoji counts as 1 | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D33 | Saving an edit with an unchanged name (or changed only by case or spacing) is allowed: no error, trimmed name saved | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D34 | Opening the delete dialog cancels an open edit (original name kept); the dialog applies to the chosen habit | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D35 | Editing never changes `id`, `createdAt` or list position | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D36 | Valid JSON with a malformed entry (missing id or name, or name over 60) is treated as corrupted under D9 | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D37 | A visible "Add" button next to the input behaves like Enter, with the same validation | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D38 | Text buttons "Edit" and "Delete" with accessible names including the habit name; delete dialog traps focus, Escape cancels, focus returns to the row's Delete button on cancel | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D39 | Usable from 320px width up with no horizontal scroll; latest two versions of Chrome, Firefox, Safari and Edge | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |
| D40 | Removing check-ins when a habit is deleted is out of scope here; `id` stays stable for the future tracking requirement | #1 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793399488815919?thread_ts=1793399488.815919&cid=C0CDNGE90V7) |

## Data
- Entity `Habit`: `id` (string, from crypto.randomUUID() or a fallback), `name` (string, trimmed, 1–60 Unicode characters), `createdAt` (ISO 8601 string), `icon` (optional string, the id of a built-in catalog icon; missing or unknown means no icon).
- localStorage key `habits:v1` holds an array of Habit in creation order.

## Not covered
- Habit fields other than name and icon.
- Uploaded, custom or network-loaded icons.
- Marking done, daily tracking and streaks.
- Removing check-ins when a habit is deleted.
- Reordering and undo of deletion.
- Toast or other save feedback.
- Export and import.
- Cross-tab syncing or merging.
- Normalising inner whitespace in names.

## History
- 2026-10-30 #1: Created the capability (create, list, edit and delete habits, stored in localStorage).
- 2026-10-30 #1: Added an optional catalog icon (D26–D31; D1 and D21 superseded), a visible "Add" button, and edge-case, data and UX rules (D32–D40).
