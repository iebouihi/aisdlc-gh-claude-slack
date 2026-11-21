import { describe, expect, it } from "vitest";
import type { Habit } from "./habits";
import {
  cellState,
  earliestDate,
  rangeLabel,
  shiftDate,
  summaryText,
  weekRows,
  weekWindow,
  windowBounds,
} from "./week";

const H = (over: Partial<Habit> = {}): Habit => ({
  id: "a",
  name: "Run",
  createdAt: "2026-01-01T00:00:00.000Z",
  frequency: { type: "daily" },
  startDate: "2026-01-01",
  ...over,
});
const TODAY = "2026-11-01"; // a Sunday

describe("week domain", () => {
  it("AC2 (#4): window is 7 local dates oldest to newest with weekday and today marker", () => {
    const w = weekWindow(TODAY, TODAY);
    expect(w).toHaveLength(7);
    expect(w[0]).toMatchObject({ date: "2026-10-26", weekday: "Mon", day: 26, isToday: false });
    expect(w[6]).toEqual({ date: "2026-11-01", weekday: "Sun", day: 1, isToday: true });
    expect(w.filter((d) => d.isToday)).toHaveLength(1);
  });

  it("AC2 (#61): a past window ends at its end date and marks today only if inside", () => {
    const past = weekWindow("2026-10-25", TODAY);
    expect(past[0].date).toBe("2026-10-19");
    expect(past[6].date).toBe("2026-10-25");
    expect(past.some((d) => d.isToday)).toBe(false);
    expect(shiftDate(TODAY, -7)).toBe("2026-10-25");
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("AC1 (#61) AC3 (#61): Next is disabled only on the current window", () => {
    expect(windowBounds(TODAY, TODAY, "2026-01-01").canNext).toBe(false);
    expect(windowBounds("2026-10-25", TODAY, "2026-01-01").canNext).toBe(true);
  });

  it("AC4 (#61): Previous is disabled on the window containing the earliest date", () => {
    // Window ending 2026-11-01 starts 2026-10-26.
    expect(windowBounds(TODAY, TODAY, "2026-10-26").canPrev).toBe(false);
    expect(windowBounds(TODAY, TODAY, "2026-10-25").canPrev).toBe(true);
    expect(windowBounds(TODAY, TODAY, null).canPrev).toBe(false);
  });

  it("AC4 (#61): earliestDate takes the earliest of createdAt and check-ins", () => {
    const h = H({ createdAt: new Date(2026, 5, 10, 12).toISOString() });
    expect(earliestDate([h], [{ habitId: "a", date: "2026-05-02" }])).toBe("2026-05-02");
    expect(earliestDate([h], [])).toBe("2026-06-10");
    expect(earliestDate([], [])).toBeNull();
  });

  it("AC10 (#61): range label, with the year when it differs from today's", () => {
    expect(rangeLabel(weekWindow("2026-10-26", TODAY), TODAY)).toBe("Oct 20 – Oct 26");
    expect(rangeLabel(weekWindow("2025-12-31", TODAY), TODAY)).toBe("Dec 25 – Dec 31, 2025");
  });

  it("AC5 (#61) AC7 (#61): in a past window unchecked is missed, never pending; check-ins done", () => {
    const h = H({ frequency: { type: "weekdays", days: [1] } });
    const end = "2026-10-25";
    expect(cellState(h, [], "2026-10-19", TODAY)).toBe("missed");
    expect(cellState(h, [{ habitId: "a", date: "2026-10-20" }], "2026-10-20", TODAY)).toBe("done");
    const [row] = weekRows([H()], [], TODAY, end);
    expect(row.cells.some((c) => c.state === "pending")).toBe(false);
  });

  it("AC6 (#61): past window counts scheduled and active days in that window", () => {
    const h = H({ startDate: "2026-10-22" }); // active 22..25 of window 19..25
    const [row] = weekRows([h], [{ habitId: "a", date: "2026-10-23" }], TODAY, "2026-10-25");
    expect(row).toMatchObject({ done: 1, scheduled: 4 });
    expect(summaryText(row)).toBe("1 of 4 scheduled days done");
  });

  it("AC8 (#61): only habits overlapping the past window are listed, creation order", () => {
    const hs = [
      H({ id: "a", startDate: "2026-10-26" }), // starts after the window
      H({ id: "b", endDate: "2026-10-18" }), // ended before it
      H({ id: "c", endDate: "2026-10-19" }),
      H({ id: "d" }),
    ];
    expect(weekRows(hs, [], TODAY, "2026-10-25").map((r) => r.habit.id)).toEqual(["c", "d"]);
  });

  it("AC3 (#4): scheduled, active, checked past day is done", () => {
    expect(cellState(H(), [{ habitId: "a", date: "2026-10-28" }], "2026-10-28", TODAY)).toBe(
      "done",
    );
  });

  it("AC4 (#4): scheduled, active, unchecked past day is missed", () => {
    expect(cellState(H(), [], "2026-10-28", TODAY)).toBe("missed");
  });

  it("AC5 (#4): unchecked unscheduled day is not scheduled", () => {
    const h = H({ frequency: { type: "weekdays", days: [1, 3, 5] } });
    expect(cellState(h, [], "2026-10-27", TODAY)).toBe("not-scheduled"); // Tuesday
  });

  it("AC6 (#4): days before start and after end are not active", () => {
    const h = H({ startDate: "2026-10-29", endDate: "2026-10-30" });
    expect(cellState(h, [], "2026-10-28", TODAY)).toBe("not-active");
    expect(cellState(h, [], "2026-10-31", TODAY)).toBe("not-active");
    expect(cellState(h, [], "2026-10-29", TODAY)).toBe("missed");
  });

  it("AC7 (#4): today scheduled and unchecked is pending, not missed", () => {
    expect(cellState(H(), [], TODAY, TODAY)).toBe("pending");
  });

  it("AC8 (#4): a check-in on an unscheduled day shows as done and is kept", () => {
    const h = H({ frequency: { type: "weekdays", days: [1] } });
    const checkins = [{ habitId: "a", date: "2026-10-27" }];
    expect(cellState(h, checkins, "2026-10-27", TODAY)).toBe("done");
    expect(checkins).toHaveLength(1);
  });

  it("AC9 (#4): rows keep creation order", () => {
    const hs = [H({ id: "a" }), H({ id: "b" }), H({ id: "c" })];
    expect(weekRows(hs, [], TODAY).map((r) => r.habit.id)).toEqual(["a", "b", "c"]);
  });

  it("AC10 (#4): ended inside window listed; ended before or starting after today hidden", () => {
    const inside = H({ id: "i", endDate: "2026-10-26" });
    const before = H({ id: "b", endDate: "2026-10-25" });
    const future = H({ id: "f", startDate: "2026-11-02" });
    expect(weekRows([inside, before, future], [], TODAY).map((r) => r.habit.id)).toEqual(["i"]);
  });

  it("AC12 (#4): counts done of scheduled and active days up to today", () => {
    const h = H({ startDate: "2026-10-28" }); // 28..1 = 5 days
    const checkins = ["2026-10-28", "2026-10-29", "2026-11-01"].map((date) => ({
      habitId: "a",
      date,
    }));
    const [row] = weekRows([h], checkins, TODAY);
    expect(row).toMatchObject({ done: 3, scheduled: 5 });
    expect(summaryText(row)).toBe("3 of 5 scheduled days done");
  });

  it("AC13 (#4): no scheduled and active days gives 'No scheduled days'", () => {
    const h = H({ frequency: { type: "weekdays", days: [2] }, startDate: "2026-10-28" });
    h.endDate = "2026-10-28";
    const [row] = weekRows([h], [], TODAY);
    expect(summaryText(row)).toBe("No scheduled days");
  });

  it("AC12 (#4): an unscheduled check-in is shown but not counted in x", () => {
    const h = H({ frequency: { type: "weekdays", days: [1] } });
    const [row] = weekRows([h], [{ habitId: "a", date: "2026-10-27" }], TODAY);
    expect(row).toMatchObject({ done: 0, scheduled: 1 });
  });
});
