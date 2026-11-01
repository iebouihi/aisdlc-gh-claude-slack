import { describe, expect, it } from "vitest";
import type { CheckIn } from "./checkins";
import type { Habit } from "./habits";
import { toLocalDate, type Frequency } from "./schedule";
import { currentStreak, streakText } from "./streak";

const H = (over: Partial<Habit> = {}): Habit => ({
  id: "a",
  name: "Run",
  createdAt: "2026-01-01T00:00:00.000Z",
  frequency: { type: "daily" },
  startDate: "2026-01-01",
  ...over,
});
const C = (...dates: string[]): CheckIn[] => dates.map((date) => ({ habitId: "a", date }));
const TODAY = "2026-11-01"; // Sunday
const MWF: Frequency = { type: "weekdays", days: [1, 3, 5] };

describe("streak domain", () => {
  it("AC1 (#3): daily habit checked on the last 3 days including today", () => {
    expect(currentStreak(H(), C("2026-10-30", "2026-10-31", TODAY), TODAY)).toBe(3);
  });

  it("AC2 (#3): unchecked today is not counted nor breaking; checking adds 1", () => {
    const past = C("2026-10-29", "2026-10-30", "2026-10-31");
    expect(currentStreak(H(), past, TODAY)).toBe(3);
    expect(currentStreak(H(), [...past, ...C(TODAY)], TODAY)).toBe(4);
  });

  it("AC3 (#3): a missed past day cuts the streak", () => {
    expect(currentStreak(H(), C("2026-10-28", "2026-10-30", "2026-10-31"), TODAY)).toBe(2);
  });

  it("AC4 (#3): singular text for 1", () => {
    expect(streakText(1)).toBe("1-day streak");
    expect(streakText(3)).toBe("3-day streak");
  });

  it("AC5 (#3): Mon/Wed/Fri habit keeps its streak across unscheduled days", () => {
    // Thursday 29 Oct: last scheduled days are Wed 28, Mon 26, Fri 23.
    const checkins = C("2026-10-28", "2026-10-26", "2026-10-23");
    expect(currentStreak(H({ frequency: MWF }), checkins, "2026-10-29")).toBe(3);
  });

  it("AC6 (#3): Mon/Wed/Fri habit that missed Wednesday counts only days after it", () => {
    // Today Sun 1 Nov: Fri 30 and Mon 26 checked; Wed 28 missed.
    expect(currentStreak(H({ frequency: MWF }), C("2026-10-30", "2026-10-26"), TODAY)).toBe(1);
  });

  it("AC7 (#3): a check-in on an unscheduled day adds nothing and breaks nothing", () => {
    // Thu 29 is unscheduled but checked; Fri 30 and Wed 28 are scheduled and checked.
    expect(
      currentStreak(H({ frequency: MWF }), C("2026-10-30", "2026-10-29", "2026-10-28"), TODAY),
    ).toBe(2);
  });

  it("AC8 (#3): no check-ins or a 0 streak reads 'No streak yet'", () => {
    expect(currentStreak(H(), [], TODAY)).toBe(0);
    expect(currentStreak(H(), C("2026-10-20"), TODAY)).toBe(0);
    expect(streakText(0)).toBe("No streak yet");
  });

  it("AC9 (#3): days before the start date never count", () => {
    expect(currentStreak(H({ startDate: TODAY }), C("2026-10-31", TODAY), TODAY)).toBe(1);
    expect(currentStreak(H({ startDate: "2026-11-05" }), C("2026-10-31", TODAY), TODAY)).toBe(0);
  });

  it("AC10 (#3): an ended habit keeps its final streak; days after the end are ignored", () => {
    const checkins = C("2026-10-27", "2026-10-28", "2026-10-29", "2026-10-31");
    expect(currentStreak(H({ endDate: "2026-10-29" }), checkins, TODAY)).toBe(3);
  });

  it("AC11 (#3): the streak follows the current schedule and keeps all check-ins", () => {
    const checkins = C("2026-10-28", "2026-10-30", "2026-10-31");
    expect(currentStreak(H(), checkins, TODAY)).toBe(2);
    // Edited to Wed, Fri, Sat: Sat 31, Fri 30 and Wed 28 are all checked.
    const edited = H({ frequency: { type: "weekdays", days: [3, 5, 6] } });
    expect(currentStreak(edited, checkins, TODAY)).toBe(3);
    expect(checkins).toHaveLength(3);
  });

  it("AC12 (#3): a habit normalised to Daily from createdAt counts like a daily one", () => {
    const h = H({ startDate: "2026-10-30" }); // what parseHabits yields for a legacy habit
    expect(currentStreak(h, C("2026-10-29", "2026-10-30", "2026-10-31"), TODAY)).toBe(2);
  });

  it("AC13 (#3): a long history is counted back to the start date with no cap", () => {
    const checkins: CheckIn[] = [];
    for (let i = 1; i <= 500; i++) {
      checkins.push({ habitId: "a", date: toLocalDate(new Date(2026, 10, 1 - i)) });
    }
    expect(currentStreak(H({ startDate: "2025-01-01" }), checkins, TODAY)).toBe(500);
  });

  it("AC14 (#3): computing a streak does not change its inputs", () => {
    const checkins = C("2026-10-31");
    const habit = H();
    const before = JSON.stringify([checkins, habit]);
    currentStreak(habit, checkins, TODAY);
    expect(JSON.stringify([checkins, habit])).toBe(before);
  });
});
