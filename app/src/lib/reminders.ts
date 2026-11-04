/** Habit reminders: which habits are due for the in-page banner. Pure, no React. */
import { isChecked, todayStatus, type CheckIn } from "./checkins";
import type { Habit } from "./habits";

/** The device's local time as "HH:mm". */
export function toLocalTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Key of one habit's dismissal on one local date. */
export function dismissalKey(habitId: string, date: string): string {
  return `${date}|${habitId}`;
}

/**
 * Habits to alert about now: a reminder time reached or passed today, checkable today (scheduled,
 * started, not ended), not done and not dismissed today. `time` is the local "HH:mm".
 */
export function dueReminders(
  habits: readonly Habit[],
  checkins: readonly CheckIn[],
  today: string,
  time: string,
  dismissed: ReadonlySet<string>,
): Habit[] {
  if (!today || !time) return [];
  return habits.filter(
    (h) =>
      h.reminderTime !== undefined &&
      h.reminderTime <= time &&
      todayStatus(h, today) === "checkable" &&
      !isChecked(checkins, h.id, today) &&
      !dismissed.has(dismissalKey(h.id, today)),
  );
}
