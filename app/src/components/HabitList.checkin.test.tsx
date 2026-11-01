import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HabitList } from "./HabitList";
import { CHECKINS_KEY, HABITS_KEY } from "@/lib/storage";

// Monday 2 Nov 2026, local time.
const NOW = new Date(2026, 10, 2, 12);
const TODAY = "2026-11-02";
const habit = (id: string, name: string, extra: object = {}) => ({
  id,
  name,
  createdAt: new Date(2026, 0, 5, 12).toISOString(),
  frequency: { type: "daily" },
  startDate: "2026-01-05",
  ...extra,
});
const seed = (habits: unknown, checkins?: unknown) => {
  localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  if (checkins !== undefined) localStorage.setItem(CHECKINS_KEY, JSON.stringify(checkins));
};
const storedCheckins = () => JSON.parse(localStorage.getItem(CHECKINS_KEY) ?? "null");
const toggleFor = (name: string) => screen.getByRole("checkbox", { name: `Done today: ${name}` });
const row = (name: string) => screen.getByRole("listitem", { name });

describe("HabitList daily check-in", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("AC1 (#2): a checkable habit shows an unchecked toggle at its start and no Done label", () => {
    seed([habit("1", "Read")]);
    render(<HabitList />);
    expect(toggleFor("Read")).not.toBeChecked();
    expect(row("Read").firstElementChild).toBe(toggleFor("Read"));
    expect(row("Read")).not.toHaveTextContent("Done");
  });

  it("AC2 (#2): clicking or pressing Space checks the habit at once, with no toast", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Read"), habit("2", "Run")]);
    render(<HabitList />);
    await user.click(toggleFor("Read"));
    expect(toggleFor("Read")).toBeChecked();
    expect(row("Read")).toHaveTextContent("✓ Done");
    expect(row("Read").className).toMatch(/done/);
    toggleFor("Run").focus();
    await user.keyboard(" ");
    expect(toggleFor("Run")).toBeChecked();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("AC3 (#2): toggling again unchecks and removes today's entry", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Read")], [{ habitId: "1", date: "2026-11-01" }]);
    render(<HabitList />);
    await user.click(toggleFor("Read"));
    expect(storedCheckinsFor()).toEqual(["2026-11-01", TODAY]);
    await user.click(toggleFor("Read"));
    expect(toggleFor("Read")).not.toBeChecked();
    expect(row("Read")).not.toHaveTextContent("Done");
    expect(storedCheckins()).toEqual([{ habitId: "1", date: "2026-11-01" }]);
  });

  it("AC4 (#2): a weekday habit not scheduled today is dimmed, labelled, with no toggle", () => {
    seed([habit("1", "Swim", { frequency: { type: "weekdays", days: [3] } })]);
    render(<HabitList />);
    expect(row("Swim")).toHaveTextContent("Not scheduled today");
    expect(row("Swim").className).toMatch(/dimmed/);
    expect(within(row("Swim")).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/done today/)).not.toBeInTheDocument();
  });

  it("AC5 (#2): a future start shows Starts <date>, a past end shows Ended, no toggle", () => {
    seed([
      habit("1", "Later", { startDate: "2026-11-10" }),
      habit("2", "Old", { endDate: "2026-10-10" }),
    ]);
    render(<HabitList />);
    expect(row("Later")).toHaveTextContent("Starts 10 Nov");
    expect(row("Old")).toHaveTextContent("Ended 10 Oct");
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("AC6 (#2): the summary reads x of y done today, counting only habits due today", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([
      habit("1", "Read"),
      habit("2", "Run"),
      habit("3", "Swim", { frequency: { type: "weekdays", days: [3] } }),
    ]);
    render(<HabitList />);
    expect(screen.getByText("0 of 2 done today")).toBeInTheDocument();
    await user.click(toggleFor("Read"));
    expect(screen.getByText("1 of 2 done today")).toBeInTheDocument();
  });

  it("AC7 (#2): a check-in survives a reload and is stored once per habit and date", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Read")]);
    const first = render(<HabitList />);
    await user.click(toggleFor("Read"));
    first.unmount();
    render(<HabitList />);
    expect(toggleFor("Read")).toBeChecked();
    expect(storedCheckins()).toEqual([{ habitId: "1", date: TODAY }]);
  });

  it("AC8 (#2): after midnight, on interaction, habits show not done and old check-ins stay", () => {
    seed([habit("1", "Read")], [{ habitId: "1", date: TODAY }]);
    render(<HabitList />);
    expect(toggleFor("Read")).toBeChecked();
    vi.setSystemTime(new Date(2026, 10, 3, 0, 5));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(toggleFor("Read")).not.toBeChecked();
    expect(storedCheckins()).toEqual([{ habitId: "1", date: TODAY }]);
  });

  it("AC9 (#2): editing name, icon and schedule keeps the check-in", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Read")], [{ habitId: "1", date: TODAY }]);
    render(<HabitList />);
    await user.click(screen.getByRole("button", { name: "Edit Read" }));
    const input = screen.getByRole("textbox", { name: "Name for Read" });
    await user.clear(input);
    await user.type(input, "Read more");
    const form = input.closest("form")!;
    await user.click(within(form).getByRole("button", { name: "Book" }));
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(storedCheckins()).toEqual([{ habitId: "1", date: TODAY }]);
    expect(toggleFor("Read more")).toBeChecked();
  });

  it("AC10 (#2): deleting a habit removes its check-ins only", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed(
      [habit("1", "Read"), habit("2", "Run")],
      [
        { habitId: "1", date: TODAY },
        { habitId: "1", date: "2026-11-01" },
        { habitId: "2", date: TODAY },
      ],
    );
    render(<HabitList />);
    await user.click(screen.getByRole("button", { name: "Delete Read" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(screen.queryByRole("listitem", { name: "Read" })).not.toBeInTheDocument();
    expect(storedCheckins()).toEqual([{ habitId: "2", date: TODAY }]);
  });

  it("AC11 (#2): corrupted check-ins show a non-blocking error, all not done, nothing overwritten", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Read")]);
    localStorage.setItem(CHECKINS_KEY, "{not json");
    render(<HabitList />);
    expect(screen.getByRole("alert")).toHaveTextContent(/check-ins could not be loaded/);
    expect(toggleFor("Read")).not.toBeChecked();
    expect(localStorage.getItem(CHECKINS_KEY)).toBe("{not json");
    await user.click(toggleFor("Read"));
    expect(storedCheckins()).toEqual([{ habitId: "1", date: TODAY }]);
  });

  it("AC12 (#2): a failed save shows the error and keeps the new status for the session", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Read")]);
    render(<HabitList />);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    await user.click(toggleFor("Read"));
    expect(screen.getByRole("alert")).toHaveTextContent(/check-ins could not be/);
    expect(toggleFor("Read")).toBeChecked();
    expect(row("Read")).toHaveTextContent("✓ Done");
  });

  it("AC13 (#2): the toggle is a native checkbox named after the habit, so it is announced", () => {
    seed([habit("1", "Read")]);
    render(<HabitList />);
    const box = toggleFor("Read");
    expect(box.tagName).toBe("INPUT");
    expect(box).toHaveAttribute("type", "checkbox");
    expect(box).toHaveAccessibleName(/Read/);
    expect(screen.getByText("0 of 1 done today")).toHaveAttribute("aria-live", "polite");
  });

  it("AC14 (#2): only today can be checked: other dates are never offered or written", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Read"), habit("2", "Later", { startDate: "2026-11-10" })]);
    render(<HabitList />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    await user.click(toggleFor("Read"));
    fireEvent.click(toggleFor("Read"));
    await user.click(toggleFor("Read"));
    expect(storedCheckins().every((c: { date: string }) => c.date === TODAY)).toBe(true);
  });
});

function storedCheckinsFor() {
  return storedCheckins().map((c: { date: string }) => c.date);
}
