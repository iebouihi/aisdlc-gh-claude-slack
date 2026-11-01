/** Discipline badges: a fixed built-in set, earned from streaks. Pure, no React. */
import type { CheckIn } from "./checkins";
import type { Habit } from "./habits";
import { isLocalDate, toLocalDate } from "./schedule";

export type Badge = {
  id: string;
  name: string;
  logo: string;
  /** Streak length (scheduled days) that earns the badge; 1 = first check-in. */
  target: number;
  rule: string;
};

/** The 5 badges, in display order (discipline-badges D4). */
export const BADGES: readonly Badge[] = [
  { id: "first-step", name: "First Step", logo: "👣", target: 1, rule: "Check in once" },
  { id: "steady-3", name: "Steady 3", logo: "🌱", target: 3, rule: "Reach a 3-day streak" },
  { id: "week-warrior", name: "Week Warrior", logo: "⚔️", target: 7, rule: "Reach a 7-day streak" },
  {
    id: "fortnight-focus",
    name: "Fortnight Focus",
    logo: "🔥",
    target: 14,
    rule: "Reach a 14-day streak",
  },
  {
    id: "iron-discipline",
    name: "Iron Discipline",
    logo: "🏆",
    target: 30,
    rule: "Reach a 30-day streak",
  },
];

/** An earned badge: at most one entry per badge, `earnedAt` is a local "YYYY-MM-DD". */
export type EarnedBadge = { badgeId: string; earnedAt: string };

/**
 * Longest run of checked scheduled days of `habit` up to `today` (or its end date), past runs
 * included. Same counting as `currentStreak`: unscheduled days are skipped, check-ins on them
 * add nothing, and a missed scheduled day cuts the run.
 */
export function bestStreak(habit: Habit, checkins: readonly CheckIn[], today: string): number {
  if (!today || habit.startDate > today) return 0;
  const checked = new Set(checkins.filter((c) => c.habitId === habit.id).map((c) => c.date));
  const last = habit.endDate !== undefined && habit.endDate < today ? habit.endDate : today;
  const [y, m, d] = habit.startDate.split("-").map(Number);
  const days = habit.frequency.type === "weekdays" ? habit.frequency.days : null;
  let best = 0;
  let run = 0;
  for (let i = 0; ; i++) {
    const day = new Date(y, m - 1, d + i);
    const date = toLocalDate(day);
    if (date > last) break;
    if (days && !days.includes(day.getDay())) continue;
    if (checked.has(date)) {
      run++;
      if (run > best) best = run;
    } else if (date !== today) run = 0;
  }
  return best;
}

/** Add every badge reached by any single habit and not yet earned, dated `today`. */
export function awardBadges(
  earned: readonly EarnedBadge[],
  habits: readonly Habit[],
  checkins: readonly CheckIn[],
  today: string,
): EarnedBadge[] {
  if (!today) return [...earned];
  const best = Math.max(0, ...habits.map((h) => bestStreak(h, checkins, today)));
  const result = [...earned];
  for (const badge of BADGES) {
    if (best >= badge.target && !result.some((e) => e.badgeId === badge.id)) {
      result.push({ badgeId: badge.id, earnedAt: today });
    }
  }
  return result;
}

/** Ids of badges in `next` that are not in `previous`. */
export function newBadgeIds(
  previous: readonly EarnedBadge[],
  next: readonly EarnedBadge[],
): string[] {
  return next.filter((n) => !previous.some((p) => p.badgeId === n.badgeId)).map((n) => n.badgeId);
}

/**
 * Turn a stored value into earned badges. Returns null when corrupted (not an array, or an entry
 * without a string badgeId and a real local date). Unknown badge ids are dropped, duplicates collapsed.
 */
export function parseBadges(value: unknown): EarnedBadge[] | null {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const result: EarnedBadge[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const { badgeId, earnedAt } = entry as Record<string, unknown>;
    if (typeof badgeId !== "string" || badgeId === "" || !isLocalDate(earnedAt)) return null;
    if (BADGES.some((b) => b.id === badgeId) && !result.some((e) => e.badgeId === badgeId)) {
      result.push({ badgeId, earnedAt });
    }
  }
  return result;
}
