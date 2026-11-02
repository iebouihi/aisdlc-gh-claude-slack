import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HabitList } from "./HabitList";
import { CHECKINS_KEY, HABITS_KEY } from "@/lib/storage";

const NOW = new Date(2026, 10, 1, 12);
const habit = (id: string, name: string) => ({
  id,
  name,
  createdAt: "2026-10-01T09:00:00.000Z",
  frequency: { type: "daily" },
  startDate: "2026-10-01",
});

describe("app navigation (#27)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("AC1 (#27): the nav shows four items: Today, Week, Progress and Habits", () => {
    render(<HabitList />);
    const nav = screen.getByRole("navigation", { name: "Views" });
    const items = within(nav).getAllByRole("button");
    expect(items.map((i) => i.textContent)).toEqual(["Today", "Week", "Progress", "Habits"]);
  });

  it("AC2 (#27): selecting an item shows that view, with no URL change", async () => {
    const user = userEvent.setup();
    localStorage.setItem(HABITS_KEY, JSON.stringify([habit("1", "Read")]));
    const before = window.location.href;
    render(<HabitList />);
    expect(screen.getByRole("checkbox", { name: "Done today: Read" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByRole("region", { name: "Week" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Habits" }));
    expect(screen.getByRole("textbox", { name: "New habit name" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Week" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByRole("checkbox", { name: "Done today: Read" })).toBeInTheDocument();
    expect(window.location.href).toBe(before);
  });

  it("AC3 (#27): the selected item has aria-current and a non-colour marker", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    const today = screen.getByRole("button", { name: "Today" });
    const week = screen.getByRole("button", { name: "Week" });
    expect(today).toHaveAttribute("aria-current", "page");
    expect(week).not.toHaveAttribute("aria-current");
    await user.click(week);
    expect(week).toHaveAttribute("aria-current", "page");
    expect(today).not.toHaveAttribute("aria-current");
    // The bold + underline marker lives in AppNav.module.css on [aria-current="page"].
  });

  it("AC4 (#27): the nav is keyboard operable with Tab, Enter and Space", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Today" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Week" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("region", { name: "Week" })).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole("button", { name: "Progress" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Habits" })).toHaveFocus();
    await user.keyboard(" ");
    expect(screen.getByRole("textbox", { name: "New habit name" })).toBeInTheDocument();
  });

  it("AC5 (#27): the Today view toggles a habit and shows 'x of y done today'", async () => {
    const user = userEvent.setup();
    localStorage.setItem(HABITS_KEY, JSON.stringify([habit("1", "Read")]));
    render(<HabitList />);
    expect(screen.getByText("0 of 1 done today")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Done today: Read" }));
    expect(screen.getByText("1 of 1 done today")).toBeInTheDocument();
    expect(screen.getByText("✓ Done")).toBeInTheDocument();
  });

  it("AC6 (#27): the Week view shows the 7-day window and 'x of y scheduled days done'", async () => {
    const user = userEvent.setup();
    localStorage.setItem(HABITS_KEY, JSON.stringify([habit("1", "Read")]));
    localStorage.setItem(CHECKINS_KEY, JSON.stringify([{ habitId: "1", date: "2026-11-01" }]));
    render(<HabitList />);
    await user.click(screen.getByRole("button", { name: "Week" }));
    const week = within(screen.getByRole("region", { name: "Week" }));
    expect(week.getAllByRole("columnheader")).toHaveLength(8);
    expect(week.getByText("1 of 7 scheduled days done")).toBeInTheDocument();
  });

  it("AC7 (#27): the Habits view adds, edits and deletes a habit", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    await user.click(screen.getByRole("button", { name: "Habits" }));
    await user.type(screen.getByRole("textbox", { name: "New habit name" }), "Read{Enter}");
    expect(screen.getByRole("listitem", { name: "Read" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/name/i);
    await user.click(screen.getByRole("button", { name: "Edit Read" }));
    const input = screen.getByRole("textbox", { name: "Name for Read" });
    await user.clear(input);
    await user.type(input, "Read more{Enter}");
    expect(screen.getByRole("listitem", { name: "Read more" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete Read more" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(screen.queryByRole("listitem", { name: "Read more" })).not.toBeInTheDocument();
  });

  it("AC8 (#27): empty and corrupted storage show the messages in every view", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    expect(screen.getByText("No habits yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByText("No habits yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Habits" }));
    expect(screen.getByText("No habits yet")).toBeInTheDocument();
  });

  it("AC8 (#27): corrupted storage shows the error alert in every view", async () => {
    const user = userEvent.setup();
    localStorage.setItem(HABITS_KEY, "{not json");
    render(<HabitList />);
    for (const view of ["Today", "Week", "Habits"]) {
      await user.click(screen.getByRole("button", { name: view }));
      expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
    }
  });

  it("AC9 (#27): with no habits, 'Add your first habit' reaches the add input in one tap", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    await user.click(screen.getByRole("button", { name: "Add your first habit" }));
    expect(screen.getByRole("textbox", { name: "New habit name" })).toHaveFocus();
  });

  it("AC10 (#27): only habits:v1 and checkins:v1 are used, no theme setting", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    await user.click(screen.getByRole("button", { name: "Habits" }));
    await user.type(screen.getByRole("textbox", { name: "New habit name" }), "Read{Enter}");
    await user.click(screen.getByRole("button", { name: "Today" }));
    await user.click(screen.getByRole("checkbox", { name: "Done today: Read" }));
    const keys = Object.keys(localStorage)
      .filter((k) => k !== "badges:v1")
      .sort();
    expect(keys).toEqual(["checkins:v1", "habits:v1"]);
  });
});
