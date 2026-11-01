import { describe, expect, it } from "vitest";
import type { Habit } from "./habits";
import { cellState, summaryText, weekRows, weekWindow } from "./week";

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
    const w = weekWindow(TODAY);
    expect(w).toHaveLength(7);
    expect(w[0]).toMatchObject({ date: "2026-10-26", weekday: "Mon", day: 26, isToday: false });
    expect(w[6]).toEqual({ date: "2026-11-01", weekday: "Sun", day: 1, isToday: true });
    expect(w.filter((d) => d.isToday)).toHaveLength(1);
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
