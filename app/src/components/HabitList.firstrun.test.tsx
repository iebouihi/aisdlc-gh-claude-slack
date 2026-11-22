import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HabitList } from "./HabitList";
import { CHECKINS_KEY, HABITS_KEY, PROFILE_KEY, SETUP_KEY } from "@/lib/storage";

const NOW = new Date(2026, 10, 22, 12);

function keys() {
  return Object.keys(localStorage).sort();
}

describe("first-run setup (#67)", () => {
  beforeEach(() => {
    localStorage.clear(); // vitest.setup.ts marks the setup done; these tests start fresh
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("AC1 (#67) AC2 (#67): empty storage shows only the setup, 10 unchecked habits, no nav", () => {
    render(<HabitList />);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByLabelText("Your name (optional)")).toBeInTheDocument();
    const boxes = within(screen.getByRole("group")).getAllByRole("checkbox");
    expect(boxes).toHaveLength(10);
    expect(boxes.every((b) => !(b as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByRole("checkbox", { name: "Drink water" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get started" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    expect(keys()).toEqual([]);
  });

  it("AC3 (#67): a name over 30 characters shows an announced error and saves nothing", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<HabitList />);
    const field = screen.getByLabelText("Your name (optional)");
    await user.type(field, "x".repeat(31));
    await user.click(screen.getByRole("checkbox", { name: "Walk" }));
    await user.click(screen.getByRole("button", { name: "Get started" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Use at most 30 characters");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Get started" })).toBeInTheDocument();
    expect(keys()).toEqual([]);
  });

  it("AC4 (#67) AC5 (#67): a trimmed name and 3 habits are saved and shown on Today", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<HabitList />);
    await user.type(screen.getByLabelText("Your name (optional)"), "  Sara  ");
    await user.click(screen.getByRole("checkbox", { name: "Read" }));
    await user.click(screen.getByRole("checkbox", { name: "Drink water" }));
    await user.click(screen.getByRole("checkbox", { name: "Walk" }));
    await user.click(screen.getByRole("button", { name: "Get started" }));
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY)!)).toEqual({ name: "Sara" });
    const saved = JSON.parse(localStorage.getItem(HABITS_KEY)!);
    expect(saved.map((h: { name: string }) => h.name)).toEqual(["Drink water", "Walk", "Read"]);
    expect(saved[0]).toMatchObject({
      icon: "water",
      frequency: { type: "daily" },
      startDate: "2026-11-22",
    });
    expect(saved[0]).not.toHaveProperty("endDate");
    expect(saved[0]).not.toHaveProperty("cost");
    expect(saved[0]).not.toHaveProperty("budget");
    expect(JSON.parse(localStorage.getItem(SETUP_KEY)!)).toEqual({ done: true });
    expect(screen.getByRole("heading", { name: "Welcome, Sara" })).toHaveFocus();
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Habits" })).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox", { name: /Drink water|Walk|Read/ })).toHaveLength(3);
  });

  it("AC6 (#67): Get started with nothing saves only the done flag", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<HabitList />);
    await user.click(screen.getByRole("button", { name: "Get started" }));
    expect(keys()).toEqual([SETUP_KEY]);
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByText("No habits yet")).toBeInTheDocument();
  });

  it("AC7 (#67) AC8 (#67): Skip saves only the done flag and the setup stays gone after a reload", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = render(<HabitList />);
    await user.type(screen.getByLabelText("Your name (optional)"), "Sara");
    await user.click(screen.getByRole("checkbox", { name: "Walk" }));
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(keys()).toEqual([SETUP_KEY]);
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByText("No habits yet")).toBeInTheDocument();
    unmount();
    render(<HabitList />);
    expect(screen.queryByRole("button", { name: "Get started" })).toBeNull();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("AC9 (#67): any existing data key skips the setup and stays unchanged", () => {
    for (const [key, value] of [
      [PROFILE_KEY, { name: "Sam" }],
      [HABITS_KEY, []],
      [CHECKINS_KEY, []],
    ] as const) {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
      const { unmount } = render(<HabitList />);
      expect(screen.queryByRole("button", { name: "Get started" })).toBeNull();
      expect(keys()).toEqual([key]);
      expect(localStorage.getItem(key)).toBe(JSON.stringify(value));
      unmount();
    }
  });

  it("AC10 (#67): corrupted habits show the error and no setup, nothing overwritten", () => {
    localStorage.setItem(HABITS_KEY, "{broken");
    render(<HabitList />);
    expect(screen.queryByRole("button", { name: "Get started" })).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Your habits could not be loaded");
    expect(localStorage.getItem(HABITS_KEY)).toBe("{broken");
  });

  it("AC10 (#67): unavailable storage shows the error and no setup", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<HabitList />);
    expect(screen.queryByRole("button", { name: "Get started" })).toBeNull();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("AC11 (#67): a failed save shows the error and keeps the name and habits for the session", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<HabitList />);
    await user.type(screen.getByLabelText("Your name (optional)"), "Sara");
    await user.click(screen.getByRole("checkbox", { name: "Walk" }));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    await user.click(screen.getByRole("button", { name: "Get started" }));
    expect(screen.getByRole("alert")).toHaveTextContent("could not be loaded or saved");
    expect(screen.getByRole("heading", { name: "Welcome, Sara" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Walk/ })).toBeInTheDocument();
  });

  it("AC13 (#67): the name is editable in Habits and no control reopens the setup", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<HabitList />);
    await user.type(screen.getByLabelText("Your name (optional)"), "Sara");
    await user.click(screen.getByRole("button", { name: "Get started" }));
    await user.click(screen.getByRole("button", { name: "Habits" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const field = screen.getByLabelText("Your name (optional)");
    await user.clear(field);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /setup|get started/i })).toBeNull();
  });

  it("AC14 (#67): a starter habit is a normal habit: it can be checked in and deleted", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<HabitList />);
    await user.click(screen.getByRole("checkbox", { name: "Walk" }));
    await user.click(screen.getByRole("button", { name: "Get started" }));
    await user.click(screen.getByRole("checkbox", { name: /Walk/ }));
    expect(JSON.parse(localStorage.getItem(CHECKINS_KEY)!)).toEqual([
      expect.objectContaining({ date: "2026-11-22" }),
    ]);
    await user.click(screen.getByRole("button", { name: "Habits" }));
    await user.click(screen.getByRole("button", { name: "Delete Walk" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(JSON.parse(localStorage.getItem(HABITS_KEY)!)).toEqual([]);
  });
});
