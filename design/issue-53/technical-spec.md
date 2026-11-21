---
issue: 53
title: Mood correlation
specs: [habits/mood-correlation, habits/daily-check-in, habits/habit-management]
decisions: [TD9, TD10, TD11]
mockup: mockup.html
status: proposed
updated: 2026-11-21
---
# Technical design: #53 Mood correlation

## Approach
Mood is a new entity, so it gets its own key `mood:v1` (TD2) and its own pure domain module
`src/lib/mood.ts`, following the check-in pattern (parse, set, clear, error state in `HabitList`).
The insights are computed on render from `mood:v1`, `checkins:v1` and `habits:v1` (TD1), reusing
`todayStatus(habit, date)` to decide "scheduled and active" for any past date, so no schedule logic
is duplicated. Two new thin components, `MoodPicker` and `Insights`, are rendered in the Today view:
the picker next to the "x of y done today" summary, the insights under the list (above Badges).
Check-ins are untouched, so `habits/daily-check-in` D3 holds by construction.

## Technical decisions
| ID | Decision | Reason | Status |
|---|---|---|---|
| TD1 | Insights are computed on render, not stored | one source of truth | existing |
| TD2 | Mood is a new entity: own key `mood:v1`; `habits:v1`/`checkins:v1` unchanged | no migration | existing |
| TD3 | `parseMood` marks malformed data corrupted; nothing is overwritten until the next save | never crash or lose data | existing |
| TD9 | The mood day is a day offset (0–5) in `HabitList` session state, mapped to a date with `today` | stays correct across midnight (TD5) | new |
| TD10 | "Scheduled and active on date X" = `todayStatus(habit, X) === "checkable"`, also for past dates | one rule for schedule logic | new |
| TD11 | Insights are pure functions in `src/lib/mood.ts`; thresholds (7 days, 3 / 3, 0.2) are named constants | testable without rendering, one place to change | new |

## Modules and files
| Module (code map) | File | Change |
|---|---|---|
| Storage helper | `src/lib/storage.ts` | add `MOOD_KEY = "mood:v1"` |
| Mood domain (new) | `src/lib/mood.ts` | see below |
| Mood UI (new) | `src/components/MoodPicker.tsx` + `.module.css` | day select, 5 radios, Clear |
| Mood UI (new) | `src/components/Insights.tsx` + `.module.css` | note, progress, habit rows |
| Habit UI | `src/components/HabitList.tsx` | `moods`, `moodError`, `moodDay` state; read in the load effect; `setMood`/`clearMood` handlers; render both components in the Today view; mood alert |
| Code map | `app/ARCHITECTURE.md` | developer adds the module row and convention |

`src/lib/mood.ts` (pure):
```ts
export type MoodEntry = { date: string; value: 1 | 2 | 3 | 4 | 5 };
export const MOOD_LEVELS: { value: number; emoji: string; label: string }[]; // 1 "Very low" … 5 "Very high"
export const MOOD_WINDOW_DAYS = 6;                      // today + 5 previous
export const MIN_MOOD_DAYS = 7, MIN_SIDE_DAYS = 3, NO_LINK_BELOW = 0.2;
parseMood(value: unknown): MoodEntry[] | null           // null = corrupted; duplicate dates collapsed
moodDays(today: string): { offset: number; date: string; label: string }[] // "Today", "Yesterday", then ISO date
setMood(moods, date, value): MoodEntry[]                // replaces the entry of that date
clearMood(moods, date): MoodEntry[]
insights(habits, checkins, moods): { logged: number; ready: boolean; rows: InsightRow[] }
type InsightRow = { habitId: string; name: string; status: "ok" | "no-link" | "not-enough"; diff?: number; days: number }
insightText(row): string                                // "+0.8 on days done", "no clear link", "Not enough data yet"
```
`insights`: `logged` = distinct mood dates (all stored entries); `ready` = `logged >= 7`. Per habit, over
mood dates where `todayStatus(habit, date) === "checkable"`: done = `isChecked`, otherwise not done
(AC11); other dates are ignored (AC12). `not-enough` if done < 3 or not done < 3; otherwise
`diff` = mean(done) − mean(not done), `no-link` when unrounded `|diff| < 0.2` (AC13), else `ok`,
shown rounded to 1 decimal with sign. `days` = done + not done. Rows with a diff are sorted by
`diff` descending, `not-enough` rows after them, creation order within ties (AC14). Deleted habits
are not in `habits`, so they vanish (AC18); renamed ones keep their `id` (AC19).

## Data and storage
- New key `mood:v1`: `[{ "date": "2026-11-21", "value": 4 }]`, at most one entry per date, local dates (TD5). Clearing removes the entry.
- Corrupted = not an array, an entry without a real local date (`isLocalDate`), or a value that is not an integer 1–5. Missing key = empty, not corrupted. Corrupted or unavailable at load → `moodError`, moods empty, no write until a save.
- Failed write after load: `moodError` set, in-memory state keeps the change (as check-ins).
- Entries older than 5 days are kept and count in insights; the UI cannot change them.
- Deleting a habit does not touch `mood:v1` (AC18). No network call anywhere (AC25).

## State and components
- `HabitList` owns `moods` (stored), `moodError` (session) and `moodDay` (session offset, default 0, not stored, TD9). Selected date = `moodDays(today)[moodDay].date`.
- Alert text: "Your mood entries could not be loaded or saved. Changes may be lost when you close this page.", shown only when no other storage alert is shown (existing single-alert rule).
- Today view tree: `todaySummary` + `MoodPicker` → habit list → `Insights` (`section`, `h2` "Insights") → Badges.
- `MoodPicker` props: `days`, `dayIndex`, `onDay`, `value?`, `onSelect(value)`, `onClear`. Day = labelled native `select`; levels = native radios (`name="mood"`) in a `fieldset` with legend "How is your mood?", each label = emoji (`aria-hidden`) + text; "Clear" is a button, disabled when the day has no mood. A radio change saves immediately (AC2).
- `Insights` takes the result of `insights()`. The note is always rendered (AC15). Re-renders on any state change (AC17), no toast.
- Both render only in the Today view and when `habits.length > 0` (the habit list is shown, AC1).

## Acceptance criteria → design
| AC | Design element | Test (where) |
|---|---|---|
| AC1 | `MoodPicker` beside the summary, `MOOD_LEVELS` (mockup A) | component, `HabitList.mood.test.tsx` |
| AC2 | radio change → `setMood`, no confirm or toast (A, B) | component |
| AC3 | `setMood` replaces by date | unit `mood.test.ts` + component |
| AC4 | `clearMood`, "Clear" button (A) | unit + component |
| AC5 | `moodDays(today)`: 6 entries (B) | unit |
| AC6 | `setMood` with the selected date; check-in state untouched | component |
| AC7 | row checkbox unchanged, `today` only | component |
| AC8 | `ready === false` → "Not enough data yet", "x of 7 days logged" (C) | unit + component |
| AC9 | row `ok` + `insightText` + "based on N days" (D) | unit |
| AC10 | row `not-enough` (D) | unit |
| AC11 | missing check-in = not done | unit |
| AC12 | non-`checkable` dates skipped (TD10) | unit |
| AC13 | `no-link` on unrounded `|diff| < 0.2` (D) | unit |
| AC14 | sort by `diff` desc, negatives kept (D) | unit |
| AC15 | always-rendered note (C, D) | component |
| AC16 | `insightText` and labels use "tends to go with" | unit (no "improves"/"causes" outside the note's negation) |
| AC17 | computed on render from state | component |
| AC18 | habit absent from `habits`; `mood:v1` untouched | component |
| AC19 | rows keyed by `habit.id`, name from the habit | component |
| AC20 | `MOOD_KEY`, `parseMood`, one write path | unit + component |
| AC21 | `parseMood` null → `moodError`, empty, no write (E) | component |
| AC22 | write failure → `moodError`, state kept (E) | component |
| AC23 | native radios, select, button; visible focus (F) | component (roles, `checked`) |
| AC24 | wrapping layout, `min-width: 0` (mobile frames) | CSS layout test like `HabitForm.layout.test.tsx` |
| AC25 | only `localStorage`, no fetch | component (spy on `fetch`) |

## UI
- Mockup `mockup.html`, states: A no mood set (mobile + desktop), B previous day selected with its 6-day list, C not enough data, D results (positive, negative, no clear link, per-habit not enough), E storage error, F keyboard focus.
- Insight row: habit name, then "+0.8 on days done" / "-0.5 on days done" / "no clear link" / "Not enough data yet", and "based on N days". The sign is part of the text, never colour alone. Section intro: "A plus means a habit tends to go with a better mood on days it is done."
- Accessibility: `fieldset` + `legend`, native radios (arrow keys, selected state announced), labelled select, `role="alert"` for the error, tokens for contrast and focus.

## Risks and trade-offs
- Missing check-ins counted as "not done" bias the result; stated in the note.
- `todayStatus` uses the current schedule for past dates, so editing a schedule changes past counts (accepted in the issue).
- Moods older than 5 days count in insights though they can't be edited; limiting insights to the window would make the 7-day minimum unreachable for non-daily logging.

## Open questions
- With no habits there is no mood input (AC1 ties it to the habit list). Recommended: keep it so; insights would be empty anyway.
