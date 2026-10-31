import { describe, expect, it } from "vitest";
import {
  ERROR_END_BEFORE_START,
  ERROR_END_PAST,
  ERROR_NO_DAYS,
  ERROR_START_PAST,
  hasEnded,
  summarize,
  toLocalDate,
  validateSchedule,
  type Schedule,
} from "./schedule";

const TODAY = "2026-11-12";
const daily: Schedule = { frequency: { type: "daily" }, startDate: TODAY };

describe("validateSchedule", () => {
  it("AC3 (#15): a new habit starting in the past is rejected, today is fine", () => {
    expect(validateSchedule({ ...daily, startDate: "2026-11-11" }, TODAY).start).toBe(
      ERROR_START_PAST,
    );
    expect(validateSchedule(daily, TODAY)).toEqual({});
  });
  it("AC4 (#15): an end date before the start date is rejected (add and edit)", () => {
    const s = { ...daily, endDate: "2026-11-13", startDate: "2026-11-14" };
    expect(validateSchedule(s, TODAY).end).toBe(ERROR_END_BEFORE_START);
    expect(validateSchedule(s, TODAY, daily).end).toBe(ERROR_END_BEFORE_START);
    expect(validateSchedule({ ...daily, endDate: TODAY }, TODAY).end).toBeUndefined();
  });
  it("AC5 (#15): weekdays with no day is rejected", () => {
    const s: Schedule = { frequency: { type: "weekdays", days: [] }, startDate: TODAY };
    expect(validateSchedule(s, TODAY).days).toBe(ERROR_NO_DAYS);
  });
  it("AC8 (#15): an unchanged past start date stays valid when editing", () => {
    const old: Schedule = { frequency: { type: "daily" }, startDate: "2026-01-01" };
    const next: Schedule = { ...old, frequency: { type: "weekdays", days: [1] } };
    expect(validateSchedule(next, TODAY, old)).toEqual({});
  });
  it("AC9 (#15): changing the start date to the past is rejected when editing", () => {
    const old: Schedule = { frequency: { type: "daily" }, startDate: "2026-01-01" };
    expect(validateSchedule({ ...old, startDate: "2026-02-01" }, TODAY, old).start).toBe(
      ERROR_START_PAST,
    );
  });
  it("AC10 (#15): changing the end date to the past is rejected when editing", () => {
    const old: Schedule = { frequency: { type: "daily" }, startDate: "2026-01-01" };
    expect(validateSchedule({ ...old, endDate: "2026-11-01" }, TODAY, old).end).toBe(
      ERROR_END_PAST,
    );
    const ended = { ...old, endDate: "2026-11-01" };
    expect(validateSchedule(ended, TODAY, ended)).toEqual({});
  });
});

describe("display helpers", () => {
  it("AC6 (#15): summaries show frequency and dates", () => {
    expect(summarize(daily)).toBe("Daily · from 12 Nov");
    expect(
      summarize({
        frequency: { type: "weekdays", days: [5, 1, 3] },
        startDate: "2026-11-12",
        endDate: "2026-12-12",
      }),
    ).toBe("Mon, Wed, Fri · 12 Nov – 12 Dec");
  });
  it("AC7 (#15): a habit without an end date never ends", () => {
    expect(hasEnded(daily, "2099-01-01")).toBe(false);
  });
  it("AC11 (#15): a habit has ended when its end date is before today", () => {
    expect(hasEnded({ ...daily, endDate: "2026-11-11" }, TODAY)).toBe(true);
    expect(hasEnded({ ...daily, endDate: TODAY }, TODAY)).toBe(false);
  });
  it("AC1 (#15): toLocalDate uses the local date", () => {
    expect(toLocalDate(new Date(2026, 10, 2, 23, 59))).toBe("2026-11-02");
  });
});
