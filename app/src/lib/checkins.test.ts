import { describe, expect, it } from "vitest";
import {
  isChecked,
  parseCheckins,
  removeCheckInsFor,
  todayStatus,
  todaySummary,
  toggleCheckIn,
} from "./checkins";
import type { Habit } from "./habits";

// 2026-11-02 is a Monday.
const TODAY = "2026-11-02";
const habit = (over: Partial<Habit> = {}): Habit => ({
  id: "a",
  name: "A",
  createdAt: "2026-01-01T00:00:00.000Z",
  frequency: { type: "daily" },
  startDate: "2026-11-01",
  ...over,
});

describe("checkins", () => {
  it("AC1 (#2): a started, not ended Daily habit is checkable", () => {
    expect(todayStatus(habit(), TODAY)).toBe("checkable");
    expect(todayStatus(habit({ startDate: TODAY, endDate: TODAY }), TODAY)).toBe("checkable");
  });

  it("AC4 (#2): a weekday habit not scheduled today is not scheduled", () => {
    expect(todayStatus(habit({ frequency: { type: "weekdays", days: [2] } }), TODAY)).toBe(
      "not-scheduled",
    );
    expect(todayStatus(habit({ frequency: { type: "weekdays", days: [1] } }), TODAY)).toBe(
      "checkable",
    );
  });

  it("AC5 (#2): future start and past end have no control", () => {
    expect(todayStatus(habit({ startDate: "2026-11-03" }), TODAY)).toBe("not-started");
    expect(todayStatus(habit({ endDate: "2026-11-01" }), TODAY)).toBe("ended");
  });

  it("AC3 (#2): toggling twice removes today's entry", () => {
    const on = toggleCheckIn([], "a", TODAY);
    expect(isChecked(on, "a", TODAY)).toBe(true);
    expect(toggleCheckIn(on, "a", TODAY)).toEqual([]);
  });

  it("AC7 (#2): at most one entry per habit per date", () => {
    expect(
      parseCheckins([
        { habitId: "a", date: TODAY },
        { habitId: "a", date: TODAY },
      ]),
    ).toEqual([{ habitId: "a", date: TODAY }]);
  });

  it("AC6 (#2): the summary counts only habits scheduled and active today", () => {
    const habits = [
      habit(),
      habit({ id: "b" }),
      habit({ id: "c", frequency: { type: "weekdays", days: [3] } }),
      habit({ id: "d", startDate: "2026-12-01" }),
    ];
    const checkins = [
      { habitId: "a", date: TODAY },
      { habitId: "c", date: TODAY },
    ];
    expect(todaySummary(habits, checkins, TODAY)).toEqual({ done: 1, total: 2 });
  });

  it("AC8 (#2): yesterday's check-in does not count today but is kept", () => {
    const checkins = [{ habitId: "a", date: "2026-11-01" }];
    expect(todaySummary([habit()], checkins, TODAY)).toEqual({ done: 0, total: 1 });
    expect(toggleCheckIn(checkins, "a", TODAY)).toHaveLength(2);
  });

  it("AC10 (#2): removing a habit's check-ins keeps the others", () => {
    const checkins = [
      { habitId: "a", date: TODAY },
      { habitId: "a", date: "2026-11-01" },
      { habitId: "b", date: TODAY },
    ];
    expect(removeCheckInsFor(checkins, "a")).toEqual([{ habitId: "b", date: TODAY }]);
  });

  it("AC11 (#2): malformed check-in data is corrupted (null)", () => {
    expect(parseCheckins({})).toBeNull();
    expect(parseCheckins([null])).toBeNull();
    expect(parseCheckins([{ habitId: "a", date: "nope" }])).toBeNull();
    expect(parseCheckins([{ date: TODAY }])).toBeNull();
    expect(parseCheckins(null)).toEqual([]);
  });
});
