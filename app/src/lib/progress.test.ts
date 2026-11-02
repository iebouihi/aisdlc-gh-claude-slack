import { describe, expect, it } from "vitest";
import type { Habit } from "./habits";
import { periodDays, percentOf, progress } from "./progress";

// Sunday 1 Nov 2026.
const TODAY = "2026-11-01";
const habit = (id: string, extra: Partial<Habit> = {}): Habit => ({
  id,
  name: `H${id}`,
  createdAt: "2026-01-05T09:00:00.000Z",
  frequency: { type: "daily" },
  startDate: "2026-01-05",
  ...extra,
});
const checks = (id: string, ...dates: string[]) => dates.map((date) => ({ habitId: id, date }));

describe("progress domain (#36)", () => {
  it("AC2 (#36): the 7-day period is today plus the 6 previous local dates", () => {
    const days = periodDays(TODAY, 7);
    expect(days.map((d) => d.date)).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    expect(days[6].isToday).toBe(true);
  });

  it("AC3 (#36): the 30-day period is today plus the 29 previous local dates", () => {
    const days = periodDays(TODAY, 30);
    expect(days).toHaveLength(30);
    expect(days[0].date).toBe("2026-10-03");
    expect(days[29].date).toBe(TODAY);
  });

  it("AC4 (#36): daily habit with 3 check-ins and today unchecked is 3 of 7, 43%", () => {
    const p = progress(
      [habit("1")],
      checks("1", "2026-10-27", "2026-10-29", "2026-10-31"),
      TODAY,
      7,
    );
    expect(p.rows[0]).toMatchObject({ done: 3, expected: 7, percent: 43, todayPending: true });
  });

  it("AC5 (#36): a check-in on an unscheduled day is not counted", () => {
    const h = habit("1", { frequency: { type: "weekdays", days: [1, 3, 5] } });
    const p = progress([h], checks("1", "2026-10-27"), TODAY, 7);
    // Mon 26, Wed 28, Fri 30 are expected; Tuesday 27 is ignored.
    expect(p.rows[0]).toMatchObject({ done: 0, expected: 3, todayPending: false });
  });

  it("AC6 (#36): expected counts only active days up to today", () => {
    const started = progress([habit("1", { startDate: "2026-10-29" })], [], TODAY, 7);
    expect(started.rows[0].expected).toBe(4);
    const ended = progress(
      [habit("2", { startDate: "2026-10-01", endDate: "2026-10-28" })],
      [],
      TODAY,
      7,
    );
    expect(ended.rows[0].expected).toBe(3);
  });

  it("AC7 (#36): a habit with no expected day is kept out of totals", () => {
    const h = habit("1", { frequency: { type: "weekdays", days: [2] }, startDate: "2026-10-28" });
    const other = habit("2", { startDate: "2026-11-01" });
    const p = progress([h, other], checks("2", TODAY), TODAY, 7);
    expect(p.rows[0]).toMatchObject({ expected: 0, percent: null });
    expect(p.expected).toBe(1);
    expect(p.done).toBe(1);
  });

  it("AC8 (#36): habits ended before the period or starting after today are not listed", () => {
    const p = progress(
      [habit("1", { endDate: "2026-10-20" }), habit("2", { startDate: "2026-11-02" }), habit("3")],
      [],
      TODAY,
      7,
    );
    expect(p.rows.map((r) => r.habit.id)).toEqual(["3"]);
  });

  it("AC9 (#36): 3 of 4 and 1 of 4 give 4 of 8 and 50%", () => {
    const a = habit("1", { startDate: "2026-10-29" });
    const b = habit("2", { startDate: "2026-10-29" });
    const p = progress(
      [a, b],
      [...checks("1", "2026-10-29", "2026-10-30", "2026-10-31"), ...checks("2", "2026-10-30")],
      TODAY,
      7,
    );
    expect([p.done, p.expected, p.percent]).toEqual([4, 8, 50]);
  });

  it("AC10 (#36): overall has one done/expected pair per day (habit counts)", () => {
    const a = habit("1");
    const b = habit("2", { frequency: { type: "weekdays", days: [0] } });
    const p = progress([a, b], checks("1", TODAY), TODAY, 7);
    expect(p.perDay).toHaveLength(7);
    expect(p.perDay[6]).toEqual({ date: TODAY, done: 1, expected: 2 });
    expect(p.perDay[0]).toEqual({ date: "2026-10-26", done: 0, expected: 1 });
  });

  it("AC11 (#36): done never exceeds expected", () => {
    const h = habit("1", { frequency: { type: "weekdays", days: [1] } });
    const all = periodDays(TODAY, 7).map((d) => d.date);
    const p = progress([h], checks("1", ...all), TODAY, 7);
    expect(p.rows[0].done).toBeLessThanOrEqual(p.rows[0].expected);
    expect(p.rows[0]).toMatchObject({ done: 1, expected: 1 });
  });

  it("percentOf rounds to the nearest whole number", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(2, 3)).toBe(67);
    expect(percentOf(0, 0)).toBeNull();
  });
});
