import { describe, expect, it } from "vitest";
import { BADGES, awardBadges, bestStreak, parseBadges } from "./badges";
import type { Habit } from "./habits";

const habit = (id: string, extra: Partial<Habit> = {}): Habit => ({
  id,
  name: id,
  createdAt: "2026-01-01T12:00:00.000Z",
  frequency: { type: "daily" },
  startDate: "2026-10-01",
  ...extra,
});
const days = (id: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    habitId: id,
    date: `2026-10-${String(from + i).padStart(2, "0")}`,
  }));

describe("badges domain", () => {
  it("AC1 (#24): exactly 5 badges in the approved order", () => {
    expect(BADGES.map((b) => b.name)).toEqual([
      "First Step",
      "Steady 3",
      "Week Warrior",
      "Fortnight Focus",
      "Iron Discipline",
    ]);
  });

  it("AC3 (#24): the first check-in earns First Step dated today", () => {
    expect(awardBadges([], [habit("a")], days("a", 5, 5), "2026-10-05")).toEqual([
      { badgeId: "first-step", earnedAt: "2026-10-05" },
    ]);
  });

  it("AC4 (#24): the 3rd day of a streak earns Steady 3", () => {
    const earned = awardBadges([], [habit("a")], days("a", 3, 5), "2026-10-05");
    expect(earned.map((e) => e.badgeId)).toContain("steady-3");
  });

  it("AC5 (#24): 7, 14 and 30 day streaks earn their badges", () => {
    const ids = (to: number, today: string) =>
      awardBadges([], [habit("a")], days("a", 1, to), today).map((e) => e.badgeId);
    expect(ids(7, "2026-10-07")).toContain("week-warrior");
    expect(ids(7, "2026-10-07")).not.toContain("fortnight-focus");
    expect(ids(14, "2026-10-14")).toContain("fortnight-focus");
    expect(ids(30, "2026-10-30")).toContain("iron-discipline");
  });

  it("AC5 (#24): streaks are never added up across habits", () => {
    const checkins = [...days("a", 1, 2), ...days("b", 3, 4)];
    const earned = awardBadges([], [habit("a"), habit("b")], checkins, "2026-10-04");
    expect(earned.map((e) => e.badgeId)).not.toContain("steady-3");
  });

  it("AC6 (#24): unscheduled days do not break the streak", () => {
    // Mon/Wed/Fri; 5, 7, 9 Oct 2026 are Mon, Wed, Fri.
    const h = habit("a", { frequency: { type: "weekdays", days: [1, 3, 5] } });
    const checkins = ["2026-10-05", "2026-10-07", "2026-10-09"].map((date) => ({
      habitId: "a",
      date,
    }));
    expect(bestStreak(h, checkins, "2026-10-09")).toBe(3);
  });

  it("AC7 (#24): an earned badge is kept with its date when nothing supports it", () => {
    const earned = [{ badgeId: "first-step", earnedAt: "2026-09-01" }];
    expect(awardBadges(earned, [], [], "2026-10-05")).toEqual(earned);
  });

  it("AC8 (#24): the past streak of an ended habit earns a badge", () => {
    const h = habit("a", { endDate: "2026-10-03" });
    const earned = awardBadges([], [h], days("a", 1, 3), "2026-10-20");
    expect(earned.map((e) => e.badgeId)).toContain("steady-3");
  });

  it("AC8 (#24): a past streak that was later broken still counts", () => {
    expect(bestStreak(habit("a"), days("a", 1, 3), "2026-10-10")).toBe(3);
  });

  it("AC12 (#24): parseBadges reads [{badgeId, earnedAt}] with one entry per badge", () => {
    const entry = { badgeId: "steady-3", earnedAt: "2026-10-05" };
    expect(parseBadges([entry, entry])).toEqual([entry]);
    expect(parseBadges(null)).toEqual([]);
  });

  it("AC13 (#24): malformed badge data is corrupted", () => {
    expect(parseBadges({})).toBeNull();
    expect(parseBadges([{ badgeId: "steady-3", earnedAt: "nope" }])).toBeNull();
    expect(parseBadges(["x"])).toBeNull();
  });
});
