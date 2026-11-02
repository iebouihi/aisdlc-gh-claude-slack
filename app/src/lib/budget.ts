/** Habit budget domain logic: amount validation, current period and spend. Pure, no React. */
import type { CheckIn } from "./checkins";

export type BudgetPeriod = "weekly" | "monthly";
export type Budget = { amount: number; period: BudgetPeriod };
export type Money = { cost?: number; budget?: Budget };

export const MAX_AMOUNT = 999999.99;
export const ERROR_AMOUNT = "Enter an amount above 0, up to 999,999.99, with at most 2 decimals.";
export const ERROR_BUDGET_NEEDS_COST = "Enter a cost per check-in to set a budget.";

export const PERIOD_LABEL: Record<BudgetPeriod, string> = { weekly: "Weekly", monthly: "Monthly" };

/** Form values as typed; empty strings mean "not set". */
export type MoneyDraft = { cost: string; budgetAmount: string; period: BudgetPeriod };
export type MoneyErrors = { cost?: string; budget?: string };

export function emptyMoneyDraft(): MoneyDraft {
  return { cost: "", budgetAmount: "", period: "weekly" };
}

/** True when `value` is a finite number above 0, at most MAX_AMOUNT, with at most 2 decimals. */
export function isAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_AMOUNT &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-6
  );
}

/** Parse a typed amount ("2.50" or "2,50"); null when it is not a valid amount. */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return isAmount(value) ? value : null;
}

/** Parse a stored budget; null when malformed. */
export function parseBudget(value: unknown): Budget | null {
  if (typeof value !== "object" || value === null) return null;
  const { amount, period } = value as Record<string, unknown>;
  if (!isAmount(amount)) return null;
  if (period !== "weekly" && period !== "monthly") return null;
  return { amount, period };
}

export function draftFromMoney(habit: Money): MoneyDraft {
  return {
    cost: habit.cost === undefined ? "" : String(habit.cost),
    budgetAmount: habit.budget ? String(habit.budget.amount) : "",
    period: habit.budget?.period ?? "weekly",
  };
}

/** Validate the typed cost and budget; `money` holds the parsed values when there are no errors. */
export function validateMoney(draft: MoneyDraft): { errors: MoneyErrors; money: Money } {
  const errors: MoneyErrors = {};
  const money: Money = {};
  const costText = draft.cost.trim();
  const budgetText = draft.budgetAmount.trim();
  if (costText !== "") {
    const cost = parseAmount(costText);
    if (cost === null) errors.cost = ERROR_AMOUNT;
    else money.cost = cost;
  }
  if (budgetText !== "") {
    const amount = parseAmount(budgetText);
    if (amount === null) errors.budget = ERROR_AMOUNT;
    else money.budget = { amount, period: draft.period };
    if (costText === "" && !errors.budget) errors.budget = ERROR_BUDGET_NEEDS_COST;
  }
  return { errors, money };
}

export function hasMoneyErrors(errors: MoneyErrors): boolean {
  return Boolean(errors.cost || errors.budget);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** First and last local date (inclusive) of the period containing `today` (weekly = Mon–Sun). */
export function periodRange(period: BudgetPeriod, today: string): { start: string; end: string } {
  const [y, m, d] = today.split("-").map(Number);
  if (period === "monthly") {
    const last = new Date(y, m, 0).getDate();
    return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}` };
  }
  const sinceMonday = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return {
    start: fmt(new Date(y, m - 1, d - sinceMonday)),
    end: fmt(new Date(y, m - 1, d - sinceMonday + 6)),
  };
}

export type BudgetStatus = {
  /** Amounts in cents. */
  spent: number;
  budget: number;
  left: number;
  over: number;
};

/** Spend in the current period (cost × check-ins in it) against the budget; null without both. */
export function budgetStatus(
  habit: { id: string } & Money,
  checkins: readonly CheckIn[],
  today: string,
): BudgetStatus | null {
  if (habit.cost === undefined || !habit.budget || !today) return null;
  const { start, end } = periodRange(habit.budget.period, today);
  const count = checkins.filter(
    (c) => c.habitId === habit.id && c.date >= start && c.date <= end,
  ).length;
  const spent = Math.round(habit.cost * 100) * count;
  const budget = Math.round(habit.budget.amount * 100);
  return { spent, budget, left: Math.max(budget - spent, 0), over: Math.max(spent - budget, 0) };
}

/** Amount from cents in the device's locale, always 2 decimals, no currency symbol. */
export function formatAmount(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** "7.50 of 10.00 spent, 2.50 left" (without "left" when over budget). */
export function spentText(status: BudgetStatus): string {
  const base = `${formatAmount(status.spent)} of ${formatAmount(status.budget)} spent`;
  return status.over > 0 ? base : `${base}, ${formatAmount(status.left)} left`;
}

export function overText(status: BudgetStatus): string {
  return `Over budget by ${formatAmount(status.over)}`;
}
