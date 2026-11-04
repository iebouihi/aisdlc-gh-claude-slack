import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HabitList } from "./HabitList";
import { goTo } from "./test-utils";
import { CHECKINS_KEY, HABITS_KEY } from "@/lib/storage";

const habit = (id: string, name: string, extra: object = {}) => ({
  id,
  name,
  createdAt: new Date(2026, 0, 5, 12).toISOString(),
  frequency: { type: "daily" },
  startDate: "2026-01-05",
  reminderTime: "08:00",
  ...extra,
});
const seed = (habits: unknown, checkins?: unknown) => {
  localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  if (checkins !== undefined) localStorage.setItem(CHECKINS_KEY, JSON.stringify(checkins));
};
// Monday 2 Nov 2026, local time.
const at = (h: number, m = 0, day = 2) => vi.setSystemTime(new Date(2026, 10, day, h, m));
const tick = (ms = 10_000) => act(() => void vi.advanceTimersByTime(ms));
const banner = () => screen.queryByRole("status");

describe("HabitList reminders", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    at(7, 59);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("AC1 (#39): add and edit forms have an optional labelled time input, empty by default", () => {
    seed([habit("1", "Read", { reminderTime: undefined })]);
    render(<HabitList />);
    goTo("Habits");
    const add = screen.getByLabelText("Reminder time (optional)") as HTMLInputElement;
    expect(add.type).toBe("time");
    expect(add.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Edit Read" }));
    const inputs = screen.getAllByLabelText("Reminder time (optional)") as HTMLInputElement[];
    expect(inputs).toHaveLength(2);
    expect(inputs[1].value).toBe("");
    fireEvent.change(inputs[1], { target: { value: "08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText(/· reminder 08:00$/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(HABITS_KEY)!)[0].reminderTime).toBe("08:00");
  });

  it("AC2 (#39): at the reminder time a banner shows the habit name and a Mark done button", () => {
    seed([habit("1", "Read")]);
    render(<HabitList />);
    expect(banner()).not.toBeInTheDocument();
    at(8, 0);
    tick();
    const status = banner()!;
    expect(status).toHaveTextContent("Read");
    expect(within(status).getByRole("button", { name: /Mark done/ })).toBeInTheDocument();
    // Above the list.
    expect(
      status.compareDocumentPosition(screen.getAllByRole("list").at(-1)!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("AC3 (#39): clearing the time and saving removes the reminder text and the alert", () => {
    seed([habit("1", "Read")]);
    render(<HabitList />);
    goTo("Habits");
    fireEvent.click(screen.getByRole("button", { name: "Edit Read" }));
    const input = screen.getAllByLabelText("Reminder time (optional)")[1];
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.queryByText(/reminder/)).not.toBeInTheDocument();
    goTo("Today");
    at(9);
    tick();
    expect(banner()).not.toBeInTheDocument();
  });

  it("AC4 (#39): done, unscheduled, not started and ended habits do not alert", () => {
    seed(
      [
        habit("1", "Done"),
        habit("2", "Sunday", { frequency: { type: "weekdays", days: [0] } }),
        habit("3", "Future", { startDate: "2026-11-03" }),
        habit("4", "Ended", { endDate: "2026-11-01" }),
      ],
      [{ habitId: "1", date: "2026-11-02" }],
    );
    render(<HabitList />);
    at(9);
    tick();
    expect(banner()).not.toBeInTheDocument();
  });

  it("AC5 (#39): on open after the time, the banner shows; on focus later it shows for that day", () => {
    at(9);
    seed([habit("1", "Read")]);
    render(<HabitList />);
    expect(banner()).toHaveTextContent("Read");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    act(() => void window.dispatchEvent(new Event("focus")));
    expect(banner()).not.toBeInTheDocument();
  });

  it("AC5 (#39): a habit not due at open shows on focus once its time has passed", () => {
    seed([habit("1", "Read")]);
    render(<HabitList />);
    at(10);
    act(() => void window.dispatchEvent(new Event("focus")));
    expect(banner()).toHaveTextContent("Read");
  });

  it("AC6 (#39): several due habits share one banner, each with Mark done", () => {
    at(8, 30);
    seed([habit("1", "Read"), habit("2", "Run")]);
    render(<HabitList />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(banner()).toHaveTextContent("Read");
    expect(banner()).toHaveTextContent("Run");
    expect(within(banner()!).getAllByRole("button", { name: /Mark done/ })).toHaveLength(2);
  });

  it("AC7 (#39): Mark done checks the habit like the row toggle and closes an empty banner", () => {
    at(8, 30);
    seed([habit("1", "Read"), habit("2", "Run")]);
    render(<HabitList />);
    fireEvent.click(within(banner()!).getByRole("button", { name: "Mark done: Read" }));
    expect(screen.getByRole("checkbox", { name: "Done today: Read" })).toBeChecked();
    expect(screen.getByRole("listitem", { name: "Read" })).toHaveTextContent("✓ Done");
    expect(JSON.parse(localStorage.getItem(CHECKINS_KEY)!)).toEqual([
      { habitId: "1", date: "2026-11-02" },
    ]);
    expect(banner()).not.toHaveTextContent("Read");
    expect(banner()).toHaveTextContent("Run");
    fireEvent.click(within(banner()!).getByRole("button", { name: "Mark done: Run" }));
    expect(banner()).not.toBeInTheDocument();
  });

  it("AC8 (#39): Dismiss closes the banner, offers no snooze and does not alert again that day", () => {
    at(8, 30);
    seed([habit("1", "Read")]);
    render(<HabitList />);
    expect(screen.queryByRole("button", { name: /snooze/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(banner()).not.toBeInTheDocument();
    at(12);
    tick();
    expect(banner()).not.toBeInTheDocument();
  });

  it("AC9 (#39): a habit dismissed yesterday alerts again when the date has changed", () => {
    at(8, 30, 2);
    seed([habit("1", "Read")]);
    render(<HabitList />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(banner()).not.toBeInTheDocument();
    at(8, 30, 3);
    tick();
    expect(banner()).toHaveTextContent("Read");
  });

  it("AC10 (#39): after a reload the dismissed habit can alert once again", () => {
    at(8, 30);
    seed([habit("1", "Read")]);
    const first = render(<HabitList />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(banner()).not.toBeInTheDocument();
    first.unmount();
    render(<HabitList />);
    expect(banner()).toHaveTextContent("Read");
  });

  it("AC11 (#39): the banner is a non-modal status with icon + text and a keyboard-operable Dismiss", () => {
    at(8, 30);
    seed([habit("1", "Read")]);
    render(<HabitList />);
    const status = banner()!;
    expect(status).toHaveAttribute("role", "status");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(status).toHaveTextContent("⏰");
    expect(status).toHaveTextContent("Time to check your habits");
    const dismiss = screen.getByRole("button", { name: "Dismiss" });
    expect(dismiss.tagName).toBe("BUTTON");
    expect(dismiss).not.toHaveAttribute("tabindex", "-1");
    dismiss.focus();
    expect(dismiss).toHaveFocus();
  });

  it("AC12 (#39): habits stored without reminderTime load without error and never alert", () => {
    seed([habit("1", "Read", { reminderTime: undefined })]);
    render(<HabitList />);
    at(23, 0);
    tick();
    expect(banner()).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Read" })).toBeInTheDocument();
  });

  it("AC13 (#39): a malformed reminderTime shows a non-blocking error, an empty list, nothing overwritten", () => {
    const raw = JSON.stringify([habit("1", "Read", { reminderTime: "25:99" })]);
    localStorage.setItem(HABITS_KEY, raw);
    render(<HabitList />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(localStorage.getItem(HABITS_KEY)).toBe(raw);
  });

  it("AC14 (#39): no permission prompt and no browser notification", () => {
    const request = vi.fn();
    const ctor = vi.fn();
    vi.stubGlobal("Notification", Object.assign(ctor, { requestPermission: request }));
    at(8, 30);
    seed([habit("1", "Read")]);
    render(<HabitList />);
    expect(banner()).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    expect(ctor).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
