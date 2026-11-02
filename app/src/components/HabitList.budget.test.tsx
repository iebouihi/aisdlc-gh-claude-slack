import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderView, goTo } from "./test-utils";
import { CHECKINS_KEY, HABITS_KEY } from "@/lib/storage";
import { formatAmount, periodRange } from "@/lib/budget";
import { toLocalDate } from "@/lib/schedule";

const today = toLocalDate(new Date());
const seed = (habits: unknown, checkins: unknown[] = []) => {
  localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  localStorage.setItem(CHECKINS_KEY, JSON.stringify(checkins));
};
const stored = () => JSON.parse(localStorage.getItem(HABITS_KEY) ?? "null");
const habit = (extra: object = {}) => ({
  id: "1",
  name: "Coffee",
  createdAt: new Date(2026, 0, 5, 12).toISOString(),
  frequency: { type: "daily" },
  startDate: "2026-01-05",
  cost: 2.5,
  budget: { amount: 10, period: "weekly" },
  ...extra,
});
const checkin = (date: string, habitId = "1") => ({ habitId, date });
/** Distinct dates of the current week, never the same day twice. */
const weekDates = (n: number) => {
  const { start } = periodRange("weekly", today);
  const [y, m, d] = start.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => toLocalDate(new Date(y, m - 1, d + i)));
};
const amount = (n: number) => formatAmount(Math.round(n * 100));

const field = (name: string) => screen.getByLabelText(name);
/** The edit row comes after the add form, so its inputs are the last matches. */
const editField = (name: string) => screen.getAllByLabelText(name).at(-1)!;
const set = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });
const setAdd = (cost: string, budget: string) => {
  set("Cost per check-in (optional)", cost);
  set("Budget amount (optional)", budget);
};
async function typeName(user: ReturnType<typeof userEvent.setup>, name = "Coffee") {
  await user.type(screen.getByRole("textbox", { name: "New habit name" }), name);
}
async function startEdit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Edit Coffee" }));
}

describe("HabitList budget", () => {
  it("AC1 (#33): adding a habit with cost 2.50 and a Weekly budget of 10 shows the summary", async () => {
    const user = userEvent.setup();
    renderView("Habits");
    await typeName(user);
    setAdd("2.50", "10");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(stored()[0]).toMatchObject({ cost: 2.5, budget: { amount: 10, period: "weekly" } });
    expect(
      screen.getByText(`${amount(0)} of ${amount(10)} spent, ${amount(10)} left`),
    ).toBeInTheDocument();
  });

  it("AC2 (#33): 3 check-ins in the week show 7.50 of 10.00 spent and 2.50 left", () => {
    seed(
      [habit()],
      weekDates(3).map((d) => checkin(d)),
    );
    renderView("Habits");
    expect(
      screen.getByText(`${amount(7.5)} of ${amount(10)} spent, ${amount(2.5)} left`),
    ).toBeInTheDocument();
  });

  it("AC3 (#33): a monthly budget counts only check-ins of the current month", () => {
    const first = `${today.slice(0, 8)}01`;
    const before = toLocalDate(
      new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 0),
    );
    seed([habit({ budget: { amount: 10, period: "monthly" } })], [checkin(first), checkin(before)]);
    renderView("Habits");
    expect(
      screen.getByText(`${amount(2.5)} of ${amount(10)} spent, ${amount(7.5)} left`),
    ).toBeInTheDocument();
  });

  it("AC4 (#33): over budget shows icon and text and check-in still works", async () => {
    const user = userEvent.setup();
    seed(
      [habit()],
      weekDates(5).map((d) => checkin(d)),
    );
    renderView("Habits");
    const over = screen.getByText(`Over budget by ${amount(2.5)}`);
    expect(over).toBeInTheDocument();
    expect(over.parentElement?.querySelector("[aria-hidden='true']")).toHaveTextContent("⚠️");
    goTo("Today");
    const box = screen.getByRole("checkbox", { name: "Done today: Coffee" });
    await user.click(box);
    expect(box).toBeEnabled();
  });

  it("AC5 (#33): a budget without a cost shows an announced error and saves nothing", async () => {
    const user = userEvent.setup();
    renderView("Habits");
    await typeName(user);
    setAdd("", "10");
    await user.click(screen.getByRole("button", { name: "Add" }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Enter a cost/);
    expect(field("Budget amount (optional)")).toHaveAccessibleDescription(alert.textContent!);
    expect(stored()).toBeNull();
  });

  it("AC6 (#33): invalid amounts show an inline error and save nothing; boundaries are accepted", async () => {
    const user = userEvent.setup();
    renderView("Habits");
    await typeName(user);
    for (const bad of ["0", "-3", "abc", "1.234", "1000000"]) {
      setAdd(bad, "");
      await user.click(screen.getByRole("button", { name: "Add" }));
      expect(screen.getByRole("alert"), bad).toBeInTheDocument();
      expect(stored(), bad).toBeNull();
    }
    setAdd("0.01", "999999.99");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(stored()[0]).toMatchObject({ cost: 0.01, budget: { amount: 999999.99 } });
  });

  it("AC6 (#33): an invalid budget amount shows an error", async () => {
    const user = userEvent.setup();
    renderView("Habits");
    await typeName(user);
    setAdd("2", "0");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/^Budget:/);
    expect(stored()).toBeNull();
  });

  it("AC7 (#33): without cost and budget the habit is saved without them and has no summary", async () => {
    const user = userEvent.setup();
    renderView("Habits");
    await typeName(user);
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(stored()[0]).not.toHaveProperty("cost");
    expect(stored()[0]).not.toHaveProperty("budget");
    expect(screen.queryByText(/spent/)).not.toBeInTheDocument();
  });

  it("AC8 (#33): stored habits without cost and budget load as before and are not rewritten", () => {
    const legacy = [{ id: "1", name: "Read", createdAt: new Date(2026, 0, 5, 12).toISOString() }];
    localStorage.setItem(HABITS_KEY, JSON.stringify(legacy));
    renderView("Habits");
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(stored()).toEqual(legacy);
  });

  it("AC9 (#33): a malformed cost or budget shows the error and an empty list", () => {
    for (const bad of [
      { cost: "2.5" },
      { cost: -1 },
      { budget: { amount: 10, period: "yearly" } },
    ]) {
      seed([habit(bad)]);
      const { unmount } = renderView("Habits");
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.queryByText("Coffee")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("AC10 (#33): changing the cost recomputes spent with the new cost", async () => {
    const user = userEvent.setup();
    seed(
      [habit()],
      weekDates(2).map((d) => checkin(d)),
    );
    renderView("Habits");
    await startEdit(user);
    fireEvent.change(editField("Cost per check-in (optional)"), { target: { value: "4" } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getByText(`${amount(8)} of ${amount(10)} spent, ${amount(2)} left`),
    ).toBeInTheDocument();
  });

  it("AC11 (#33): changing the period shows the spent amount of the new period", async () => {
    const user = userEvent.setup();
    const first = `${today.slice(0, 8)}01`;
    seed([habit()], [checkin(first)]);
    renderView("Habits");
    await startEdit(user);
    fireEvent.change(editField("Budget period"),{ target: { value: "monthly" } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(stored()[0].budget.period).toBe("monthly");
    expect(
      screen.getByText(`${amount(2.5)} of ${amount(10)} spent, ${amount(7.5)} left`),
    ).toBeInTheDocument();
  });

  it("AC12 (#33): the Week view shows no cost or budget information", () => {
    seed(
      [habit()],
      weekDates(2).map((d) => checkin(d)),
    );
    renderView("Week");
    expect(screen.queryByText(/spent|budget|cost/i)).not.toBeInTheDocument();
  });

  it("AC13 (#33): the inputs are labelled, and errors are linked to their input", async () => {
    const user = userEvent.setup();
    renderView("Habits");
    for (const label of [
      "Cost per check-in (optional)",
      "Budget amount (optional)",
      "Budget period",
    ]) {
      expect(field(label)).toBeInTheDocument();
    }
    await typeName(user);
    setAdd("x", "");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(field("Cost per check-in (optional)")).toHaveAttribute("aria-invalid", "true");
    expect(field("Cost per check-in (optional)")).toHaveAccessibleDescription(/Enter an amount/);
  });

  it("AC13 (#33): the edit form shows the same labelled inputs", async () => {
    const user = userEvent.setup();
    seed([habit()]);
    renderView("Habits");
    await startEdit(user);
    expect(editField("Cost per check-in (optional)")).toHaveValue("2.5");
    expect(editField("Budget amount (optional)")).toHaveValue("10");
    expect(editField("Budget period")).toHaveValue("weekly");
  });

  it("AC14 (#33): deleting a habit removes its check-ins and budget data", async () => {
    const user = userEvent.setup();
    seed(
      [habit()],
      weekDates(2).map((d) => checkin(d)),
    );
    renderView("Habits");
    await user.click(screen.getByRole("button", { name: "Delete Coffee" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(stored()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(CHECKINS_KEY)!)).toEqual([]);
  });
});
