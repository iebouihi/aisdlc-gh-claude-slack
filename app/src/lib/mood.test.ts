import { describe, expect, it } from "vitest";
import type { CheckIn } from "./checkins";
import type { Habit } from "./habits";
import {
  clearMood,
  insights,
  insightText,
  moodDays,
  parseMood,
  setMood,
  type MoodEntry,
  type MoodValue,
} from "./mood";

const habit = (id: string, extra: Partial<Habit> = {}): Habit =>
  ({
    id,
    name: id,
    createdAt: "2026-01-01T12:00:00.000Z",
    frequency: { type: "daily" },
    startDate: "2026-01-01",
    ...extra,
  }) as Habit;

/** `n` consecutive days ending 2026-11-14 get the mood from `values` (cycled). */
const dates = (n: number) =>
  Array.from({ length: n }, (_, i) => `2026-11-${String(14 - i).padStart(2, "0")}`);
const moodsOf = (values: number[]): MoodEntry[] =>
  dates(values.length).map((date, i) => ({ date, value: values[i] as MoodValue }));
const checks = (id: string, ds: string[]): CheckIn[] => ds.map((date) => ({ habitId: id, date }));

describe("mood domain", () => {
  it("AC5 (#53): moodDays offers exactly 6 days, Today and Yesterday first", () => {
    expect(moodDays("2026-11-21").map((d) => d.label)).toEqual([
      "Today",
      "Yesterday",
      "2026-11-19",
      "2026-11-18",
      "2026-11-17",
      "2026-11-16",
    ]);
    expect(moodDays("2026-11-21")[1].date).toBe("2026-11-20");
  });

  it("AC3 (#53): setMood replaces the entry of a date, never adds a second one", () => {
    const next = setMood([{ date: "2026-11-21", value: 2 }], "2026-11-21", 5);
    expect(next).toEqual([{ date: "2026-11-21", value: 5 }]);
  });

  it("AC2 (#53): setMood adds an entry for a new date", () => {
    expect(setMood([], "2026-11-20", 4)).toEqual([{ date: "2026-11-20", value: 4 }]);
  });

  it("AC4 (#53): clearMood removes the entry of that date only", () => {
    const moods: MoodEntry[] = [
      { date: "2026-11-21", value: 2 },
      { date: "2026-11-20", value: 3 },
    ];
    expect(clearMood(moods, "2026-11-21")).toEqual([{ date: "2026-11-20", value: 3 }]);
  });

  it("AC20 (#53): parseMood accepts a missing key, collapses duplicates and rejects bad data", () => {
    expect(parseMood(null)).toEqual([]);
    expect(
      parseMood([
        { date: "2026-11-21", value: 3 },
        { date: "2026-11-21", value: 4 },
      ]),
    ).toEqual([{ date: "2026-11-21", value: 3 }]);
    expect(parseMood("x")).toBeNull();
    expect(parseMood([{ date: "2026-13-40", value: 3 }])).toBeNull();
    expect(parseMood([{ date: "2026-11-21", value: 6 }])).toBeNull();
    expect(parseMood([{ date: "2026-11-21", value: 2.5 }])).toBeNull();
  });

  it("AC8 (#53): fewer than 7 days logged is not ready and has no rows", () => {
    const result = insights([habit("a")], [], moodsOf([3, 3, 3, 3]));
    expect(result).toEqual({ logged: 4, ready: false, rows: [] });
  });

  it("AC9 (#53): the difference is mean done minus mean not done, rounded to 1 decimal", () => {
    // days 14..8: done on the first 4 (moods 5,5,4,4), not done on the last 3 (3,4,4)... mean 4.5 vs 3.67
    const moods = moodsOf([5, 5, 4, 4, 3, 4, 4]);
    const done = checks("a", dates(7).slice(0, 4));
    const result = insights([habit("a")], done, moods);
    expect(result.ready).toBe(true);
    const row = result.rows[0];
    expect(row).toMatchObject({ status: "ok", days: 7 });
    expect(row.diff).toBeCloseTo(4.5 - 11 / 3, 5);
    expect(insightText(row)).toBe("+0.8 on days done");
  });

  it("AC10 (#53): fewer than 3 days done or not done is Not enough data yet, without a difference", () => {
    const moods = moodsOf([5, 5, 4, 4, 3, 4, 4]);
    const few = insights([habit("a")], checks("a", dates(7).slice(0, 2)), moods).rows[0];
    expect(few.diff).toBeUndefined();
    expect(insightText(few)).toBe("Not enough data yet");
    const fewNot = insights([habit("a")], checks("a", dates(7).slice(0, 5)), moods).rows[0];
    expect(insightText(fewNot)).toBe("Not enough data yet");
  });

  it("AC11 (#53): a mood day without a check-in counts as not done", () => {
    const moods = moodsOf([5, 5, 5, 1, 1, 1, 3]);
    const row = insights([habit("a")], checks("a", dates(7).slice(0, 3)), moods).rows[0];
    // done mean 5; not done (1,1,1,3) mean 1.5
    expect(row.diff).toBeCloseTo(3.5, 5);
    expect(row.days).toBe(7);
  });

  it("AC12 (#53): days before the start, after the end or off the weekday are ignored", () => {
    const moods = moodsOf([5, 5, 5, 1, 1, 1, 3, 3, 3]); // 2026-11-14 .. 2026-11-06
    const h = habit("a", { startDate: "2026-11-08", endDate: "2026-11-13" });
    const row = insights([h], checks("a", ["2026-11-13", "2026-11-12", "2026-11-11"]), moods)
      .rows[0];
    // active 08..13: 13,12 (5,5), 11 (5), 10,9,8 (1,1,1)... only active days count
    expect(row.days).toBe(6);
    const weekdays = habit("b", { frequency: { type: "weekdays", days: [1] } }); // Mondays
    expect(insights([weekdays], [], moods).rows[0].days).toBe(1); // 2026-11-09 is a Monday
  });

  it("AC13 (#53): an unrounded difference under 0.2 is no clear link", () => {
    const moods = moodsOf([4, 4, 4, 3, 3, 3, 4, 3, 4]);
    // done 4,4,4,3,3 = 3.6; not done 3,4,3,4 = 3.5 -> +0.1
    const row = insights([habit("a")], checks("a", dates(9).slice(0, 5)), moods).rows[0];
    expect(row.status).toBe("no-link");
    expect(insightText(row)).toBe("no clear link");
  });

  it("AC14 (#53): rows sort from largest positive to lowest, negatives kept, not-enough last", () => {
    const moods = moodsOf([5, 5, 5, 1, 1, 1, 3]);
    const ds = dates(7);
    const rows = insights(
      [habit("neg"), habit("none"), habit("pos")],
      [
        ...checks("pos", ds.slice(0, 3)),
        ...checks("neg", ds.slice(3, 6)),
        ...checks("none", [ds[0]]),
      ],
      moods,
    ).rows;
    expect(rows.map((r) => r.habitId)).toEqual(["pos", "neg", "none"]);
    expect(insightText(rows[1])).toMatch(/^-\d\.\d on days done$/);
  });

  it("AC16 (#53): result texts never say improves or causes", () => {
    const texts = [
      insightText({ habitId: "a", name: "a", status: "ok", diff: 0.8, days: 8 }),
      insightText({ habitId: "a", name: "a", status: "ok", diff: -0.5, days: 8 }),
      insightText({ habitId: "a", name: "a", status: "no-link", diff: 0.1, days: 8 }),
      insightText({ habitId: "a", name: "a", status: "not-enough", days: 2 }),
    ].join(" ");
    expect(texts).not.toMatch(/improves|causes/i);
  });

  it("AC18 (#53): a habit that is no longer in the list has no row", () => {
    const moods = moodsOf([5, 5, 5, 1, 1, 1, 3]);
    expect(insights([], checks("gone", dates(7)), moods).rows).toEqual([]);
  });
});
