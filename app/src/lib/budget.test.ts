import { describe, expect, it } from "vitest";
import {
  budgetStatus,
  formatAmount,
  overText,
  parseAmount,
  parseBudget,
  periodRange,
  spentText,
  validateMoney,
} from "./budget";
import { addHabit, parseHabits, updateHabit } from "./habits";

const draft = (cost: string, budgetAmount: string, period: "weekly" | "monthly" = "weekly") => ({
  cost,
  budgetAmount,
  period,
});
const habit = { id: "1", cost: 2.5, budget: { amount: 10, period: "weekly" as const } };

describe("budget", () => {
  it("AC6 (#33): amounts of 0, negative, text, 3 decimals or above the maximum are rejected", () => {
    for (const bad of ["0", "-1", "abc", "1.234", "1000000", "1e3", "0.00"]) {
      expect(parseAmount(bad), bad).toBeNull();
      expect(validateMoney(draft(bad, "")).errors.cost, bad).toBeTruthy();
    }
  });

  it("AC6 (#33): 0.01 and 999999.99 are accepted", () => {
    expect(parseAmount("0.01")).toBe(0.01);
    expect(parseAmount("999999.99")).toBe(999999.99);
    expect(validateMoney(draft("0.01", "999999.99")).errors).toEqual({});
  });

  it("AC5 (#33): a budget without a cost is an error", () => {
    expect(validateMoney(draft("", "10")).errors.budget).toBeTruthy();
  });

  it("AC7 (#33): empty cost and budget give no errors and no values", () => {
    expect(validateMoney(draft("", ""))).toEqual({ errors: {}, money: {} });
  });

  it("AC2 (#33): weekly spent is cost × check-ins in the Mon–Sun week", () => {
    // 2026-11-04 is a Wednesday: the week is 2026-11-02 to 2026-11-08.
    expect(periodRange("weekly", "2026-11-04")).toEqual({ start: "2026-11-02", end: "2026-11-08" });
    expect(periodRange("weekly", "2026-11-08")).toEqual({ start: "2026-11-02", end: "2026-11-08" });
    expect(periodRange("weekly", "2026-11-02").start).toBe("2026-11-02");
    const checkins = ["2026-11-02", "2026-11-04", "2026-11-08", "2026-11-01", "2026-11-09"].map(
      (date) => ({ habitId: "1", date }),
    );
    const status = budgetStatus(habit, checkins, "2026-11-04")!;
    expect(status).toEqual({ spent: 750, budget: 1000, left: 250, over: 0 });
    expect(spentText(status)).toBe(
      `${formatAmount(750)} of ${formatAmount(1000)} spent, ${formatAmount(250)} left`,
    );
  });

  it("AC3 (#33): monthly counts only the current calendar month", () => {
    expect(periodRange("monthly", "2026-02-15")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
    const monthly = { ...habit, budget: { amount: 10, period: "monthly" as const } };
    const checkins = ["2026-10-31", "2026-11-01", "2026-11-30", "2026-12-01"].map((date) => ({
      habitId: "1",
      date,
    }));
    expect(budgetStatus(monthly, checkins, "2026-11-15")!.spent).toBe(500);
  });

  it("AC3 (#33): other habits' check-ins are not counted", () => {
    const checkins = [{ habitId: "2", date: "2026-11-04" }];
    expect(budgetStatus(habit, checkins, "2026-11-04")!.spent).toBe(0);
  });

  it("AC4 (#33): over budget gives the overspend", () => {
    const checkins = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"].map(
      (date) => ({ habitId: "1", date }),
    );
    const status = budgetStatus(habit, checkins, "2026-11-06")!;
    expect(status).toMatchObject({ spent: 1250, over: 250, left: 0 });
    expect(overText(status)).toBe(`Over budget by ${formatAmount(250)}`);
  });

  it("AC10 (#33): a changed cost recomputes the spend with the new cost", () => {
    const checkins = [{ habitId: "1", date: "2026-11-04" }];
    expect(budgetStatus({ ...habit, cost: 4 }, checkins, "2026-11-04")!.spent).toBe(400);
  });

  it("AC7 (#33): no summary without a budget or a cost", () => {
    expect(budgetStatus({ id: "1", cost: 2 }, [], "2026-11-04")).toBeNull();
    expect(budgetStatus({ id: "1" }, [], "2026-11-04")).toBeNull();
  });

  it("AC9 (#33): malformed stored budgets are rejected", () => {
    expect(parseBudget({ amount: 10, period: "weekly" })).toEqual({ amount: 10, period: "weekly" });
    for (const bad of [
      { amount: "10", period: "weekly" },
      { amount: -1, period: "weekly" },
      { amount: 10, period: "daily" },
      { amount: 10 },
      "x",
      null,
    ]) {
      expect(parseBudget(bad)).toBeNull();
    }
  });

  it("AC9 (#33): parseHabits treats a malformed cost or budget as corrupted", () => {
    const base = { id: "1", name: "Read" };
    expect(parseHabits([{ ...base, cost: "2" }])).toBeNull();
    expect(parseHabits([{ ...base, cost: -2 }])).toBeNull();
    expect(parseHabits([{ ...base, cost: 2, budget: { amount: 5, period: "yearly" } }])).toBeNull();
    expect(parseHabits([{ ...base, cost: 2, budget: 5 }])).toBeNull();
  });

  it("AC8 (#33): habits without cost and budget parse without those fields", () => {
    const [parsed] = parseHabits([{ id: "1", name: "Read" }])!;
    expect(parsed).not.toHaveProperty("cost");
    expect(parsed).not.toHaveProperty("budget");
  });

  it("AC1 (#33): addHabit stores cost and budget; updateHabit changes and clears them", () => {
    const added = addHabit([], "Read", undefined, new Date(), undefined, {
      cost: 2.5,
      budget: { amount: 10, period: "weekly" },
    });
    expect(added[0]).toMatchObject({ cost: 2.5, budget: { amount: 10, period: "weekly" } });
    const changed = updateHabit(added, added[0].id, "Read", undefined, undefined, { cost: 3 });
    expect(changed[0].cost).toBe(3);
    expect(changed[0]).not.toHaveProperty("budget");
    expect(updateHabit(added, added[0].id, "Read", undefined)[0].cost).toBe(2.5);
  });
});
