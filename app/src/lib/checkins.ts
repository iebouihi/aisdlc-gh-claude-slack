/** Daily check-in domain logic: today's status and check-in list updates. Pure, no React. */
import type { Habit } from "./habits";
import { isLocalDate } from "./schedule";

/** One habit done on one local date ("YYYY-MM-DD"). At most one entry per habit per date. */
export type CheckIn = { habitId: string; date: string };

/** What a habit row offers today: a check control, or the reason it has none. */
export type TodayStatus = "checkable" | "not-scheduled" | "not-started" | "ended";

export const NOT_SCHEDULED_TEXT = "Not scheduled today";

/** Status of `habit` on `today` (local date). Start/end are checked before the weekday. */
export function todayStatus(habit: Habit, today: string): TodayStatus {
  if (habit.startDate > today) return "not-started";
  if (habit.endDate !== undefined && habit.endDate < today) return "ended";
  if (habit.frequency.type === "weekdays") {
    const [y, m, d] = today.split("-").map(Number);
    const weekday = new Date(y, m - 1, d).getDay();
    if (!habit.frequency.days.includes(weekday)) return "not-scheduled";
  }
  return "checkable";
}

export function isChecked(checkins: readonly CheckIn[], habitId: string, date: string): boolean {
  return checkins.some((c) => c.habitId === habitId && c.date === date);
}

/**
 * Turn a stored value into check-ins. Returns null when corrupted (not an array, or an entry
 * without a string habitId and a real local date). Duplicates are collapsed.
 */
export function parseCheckins(value: unknown): CheckIn[] | null {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const result: CheckIn[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const { habitId, date } = entry as Record<string, unknown>;
    if (typeof habitId !== "string" || habitId === "" || !isLocalDate(date)) return null;
    if (!isChecked(result, habitId, date)) result.push({ habitId, date });
  }
  return result;
}

/** Add the entry when missing, remove it when present. Other entries are untouched. */
export function toggleCheckIn(
  checkins: readonly CheckIn[],
  habitId: string,
  date: string,
): CheckIn[] {
  if (isChecked(checkins, habitId, date)) {
    return checkins.filter((c) => !(c.habitId === habitId && c.date === date));
  }
  return [...checkins, { habitId, date }];
}

/** Remove every check-in of a deleted habit. */
export function removeCheckInsFor(checkins: readonly CheckIn[], habitId: string): CheckIn[] {
  return checkins.filter((c) => c.habitId !== habitId);
}

/** Counts for the "x of y done today" summary: habits scheduled and active today. */
export function todaySummary(
  habits: readonly Habit[],
  checkins: readonly CheckIn[],
  today: string,
): { done: number; total: number } {
  const due = habits.filter((h) => todayStatus(h, today) === "checkable");
  return { done: due.filter((h) => isChecked(checkins, h.id, today)).length, total: due.length };
}
