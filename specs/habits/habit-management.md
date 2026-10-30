---
id: habits/habit-management
title: Habit management
module: habits
summary: Create, list, edit and delete habits by name; stored only in the browser's localStorage.
entities: [Habit]
status: active
issues: [1]
updated: 2026-10-30
---
# Habit management

## Current behaviour
- A Habit has only a name. The app is static Next.js, with no backend and no login.
- An add input is always visible at the top of the list. Enter saves the new habit and clears the input. No toast is shown.
- The list shows habits in creation order, oldest first. New habits appear at the bottom. Habits cannot be reordered.
- Names are trimmed and must be 1 to 60 characters. The input has no maxlength attribute, so pasted over-long text still shows the error.
- Inline errors: empty "Enter a habit name."; over 60 characters "Name must be 60 characters or fewer."; duplicate "You already have this habit."
- Duplicates are compared after trimming and case-folding only. Inner whitespace is kept as typed. When editing, the habit being edited is ignored in the check.
- Each row is edited inline. Enter saves and Escape cancels. Only one row is editable at a time. Starting another edit or clicking away cancels the current edit and keeps the original name.
- Delete asks for confirmation in a dialog. Deletion is permanent, with no undo.
- Empty state shows "No habits yet" and a prominent "Add your first habit" button. The button focuses the add input.
- Nothing is rendered in the list until storage has been read on the client, so the empty state never flashes.
- If stored data is corrupted or localStorage is unavailable at load, a non-blocking error message is shown and the list starts empty. The app never crashes. Corrupted data is not overwritten until the user saves a change.
- If saving fails after load, the same non-blocking error is shown and the change stays visible for the current session.
- Focus: after a delete it moves to the next habit's row, or to the add input if the list is empty. After an edit is saved or cancelled it returns to that row's edit button.
- Accessibility: everything is keyboard-operable, with labelled inputs, visible focus, errors announced to screen readers, and WCAG 2.1 AA contrast.
- Several tabs: last write wins.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | A habit has a name only; no description, target, frequency, color or icon | #1 | Slack thread |
| D2 | Marking done, tracking and streaks are separate requirements | #1 | Slack thread |
| D3 | Name is trimmed, 1–60 characters; empty shows an inline error and nothing is saved | #1 | Slack thread |
| D4 | No duplicate names (trimmed, case-insensitive); error "You already have this habit." | #1 | Slack thread |
| D5 | No hard limit on the number of habits | #1 | Slack thread |
| D6 | Delete needs a confirmation dialog; permanent, no undo | #1 | Slack thread |
| D7 | Empty state: "No habits yet" and a prominent "Add your first habit" button | #1 | Slack thread |
| D8 | Stored in localStorage under one versioned key; each habit has id, name, createdAt | #1 | Slack thread |
| D9 | Corrupted data or unavailable storage: non-blocking error, empty list, no crash, no overwrite until the user saves | #1 | Slack thread |
| D10 | Creation order, oldest first; no reordering | #1 | Slack thread |
| D11 | Add via input at the top; edit inline; Enter saves, Escape cancels | #1 | Slack thread |
| D12 | List updates immediately after saving; no toast | #1 | Slack thread |
| D13 | Keyboard-operable, labelled inputs, visible focus, announced errors, WCAG 2.1 AA contrast | #1 | Slack thread |
| D14 | Multiple tabs: last write wins; export/import is a future requirement | #1 | Slack thread |
| D15 | D1–D14 confirmed as written | #1 | Slack thread |
| D16 | Duplicate check ignores the habit being edited | #1 | Slack thread |
| D17 | Duplicate check only trims and case-folds; inner whitespace kept | #1 | Slack thread |
| D18 | One editable row at a time; a new edit or clicking away cancels the current edit | #1 | Slack thread |
| D19 | Save failure after load: same non-blocking error, change kept for the session, no crash | #1 | Slack thread |
| D20 | "Add your first habit" focuses the add input; the input is always visible | #1 | Slack thread |
| D21 | id from crypto.randomUUID() with fallback; key `habits:v1` holds [{id, name, createdAt ISO 8601}] | #1 | Slack thread |
| D22 | Error messages "Enter a habit name." and "Name must be 60 characters or fewer."; no maxlength on the input | #1 | Slack thread |
| D23 | Focus after delete goes to the next row or the add input; after save or cancel to the row's edit button | #1 | Slack thread |
| D24 | Render nothing in the list until storage is read; no empty-state flash | #1 | Slack thread |
| D25 | Last write wins across tabs accepted; revisit with export/import | #1 | Slack thread |

## Data
- Entity `Habit`: `id` (string, from crypto.randomUUID() or a fallback), `name` (string, trimmed, 1–60 characters), `createdAt` (ISO 8601 string).
- localStorage key `habits:v1` holds an array of Habit in creation order.

## Not covered
- Habit fields other than name.
- Marking done, daily tracking and streaks.
- Reordering and undo of deletion.
- Toast or other save feedback.
- Export and import.
- Cross-tab syncing or merging.
- Normalising inner whitespace in names.

## History
- 2026-10-30 #1: Created the capability (create, list, edit and delete habits, stored in localStorage).
