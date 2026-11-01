/** Habit streak domain logic: the current streak is computed, never stored. Pure, no React. */
import type { CheckIn } from "./checkins";
import type { Habit } from "./habits";
import { toLocalDate } from "./schedule";

export const NO_STREAK_TEXT = "No streak yet";

/**
 * Current streak of `habit` on `today`: consecutive scheduled, active days checked, newest first.
 * Unscheduled days are skipped; check-ins on them add nothing. An unchecked today does not break
 * the streak (it is still open); a missed past scheduled day does. Counting stops at the start
 * date, and for an ended habit begins at its end date.
 */
export function currentStreak(habit: Habit, checkins: readonly CheckIn[], today: string): number {
  if (!today || habit.startDate > today) return 0;
  const checked = new Set(checkins.filter((c) => c.habitId === habit.id).map((c) => c.date));
  const last = habit.endDate !== undefined && habit.endDate < today ? habit.endDate : today;
  const [y, m, d] = last.split("-").map(Number);
  const days = habit.frequency.type === "weekdays" ? habit.frequency.days : null;
  let streak = 0;
  for (let i = 0; ; i++) {
    const day = new Date(y, m - 1, d - i);
    const date = toLocalDate(day);
    if (date < habit.startDate) break;
    if (days && !days.includes(day.getDay())) continue;
    if (checked.has(date)) streak++;
    else if (date !== today) break;
  }
  return streak;
}

/** "3-day streak", "1-day streak" or "No streak yet". */
export function streakText(streak: number): string {
  return streak > 0 ? `${streak}-day streak` : NO_STREAK_TEXT;
}
