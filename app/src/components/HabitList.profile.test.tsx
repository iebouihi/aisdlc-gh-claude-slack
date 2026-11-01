import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HabitList } from "./HabitList";
import { goTo, renderView } from "./test-utils";
import { BADGES_KEY, CHECKINS_KEY, HABITS_KEY, PROFILE_KEY } from "@/lib/storage";

const NOW = new Date(2026, 10, 1, 12);
const habit = {
  id: "1",
  name: "Run",
  createdAt: new Date(2026, 0, 5, 12).toISOString(),
  frequency: { type: "daily" },
  startDate: "2026-01-05",
};
const heading = () => screen.getByRole("heading", { level: 2, name: /^Welcome/ });
const welcomeBadge = () => heading().parentElement?.querySelector("p") ?? null;
const storedProfile = () => localStorage.getItem(PROFILE_KEY);

async function saveName(user: ReturnType<typeof userEvent.setup>, text: string, clear = false) {
  const field = screen.getByLabelText("Your name (optional)");
  if (clear) await user.clear(field);
  else {
    await user.clear(field);
    await user.type(field, text);
  }
  await user.click(screen.getByRole("button", { name: "Save" }));
}

describe("HabitList profile", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("AC1 (#30) AC14 (#30): without a name the heading reads Welcome and no name is asked", () => {
    renderView();
    expect(heading()).toHaveTextContent(/^Welcome$/);
    expect(screen.queryByLabelText("Your name (optional)")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("AC2 (#30) AC8 (#30): a trimmed name shows in the welcome and survives a reload", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = renderView("Habits");
    await user.click(screen.getByRole("button", { name: "Add name" }));
    await saveName(user, "  Sam ");
    goTo("Today");
    expect(heading()).toHaveTextContent("Welcome, Sam");
    expect(JSON.parse(storedProfile()!)).toEqual({ name: "Sam" });
    unmount();
    renderView();
    expect(heading()).toHaveTextContent("Welcome, Sam");
  });

  it("AC3 (#30): a 30 character name is saved and shown in full", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const name = "a".repeat(30);
    renderView("Habits");
    await user.click(screen.getByRole("button", { name: "Add name" }));
    await saveName(user, name);
    goTo("Today");
    expect(heading()).toHaveTextContent(`Welcome, ${name}`);
  });

  it("AC4 (#30): 31 characters show an announced error and keep the previous name", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: "Sam" }));
    renderView("Habits");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await saveName(user, "a".repeat(31));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText("Your name (optional)")).toHaveAttribute("aria-invalid", "true");
    expect(JSON.parse(storedProfile()!)).toEqual({ name: "Sam" });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    goTo("Today");
    expect(heading()).toHaveTextContent("Welcome, Sam");
  });

  it("AC5 (#30): HTML in the name is shown as literal text", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderView("Habits");
    await user.click(screen.getByRole("button", { name: "Add name" }));
    await saveName(user, "<b>x</b>");
    goTo("Today");
    expect(heading()).toHaveTextContent("Welcome, <b>x</b>");
    expect(heading().querySelector("b")).toBeNull();
  });

  it("AC6 (#30): Cancel keeps the saved name", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: "Sam" }));
    renderView("Habits");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Your name (optional)"), "ny");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(JSON.parse(storedProfile()!)).toEqual({ name: "Sam" });
    goTo("Today");
    expect(heading()).toHaveTextContent(/^Welcome, Sam$/);
  });

  it("AC7 (#30): clearing the field and saving removes the name", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: "Sam" }));
    renderView("Habits");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await saveName(user, "", true);
    goTo("Today");
    expect(heading()).toHaveTextContent(/^Welcome$/);
  });

  it("AC9 (#30) AC17 (#30): the latest badge shows as emoji plus name", () => {
    localStorage.setItem(HABITS_KEY, JSON.stringify([habit]));
    localStorage.setItem(
      BADGES_KEY,
      JSON.stringify([
        { badgeId: "first-step", earnedAt: "2026-10-01" },
        { badgeId: "steady-3", earnedAt: "2026-10-05" },
      ]),
    );
    renderView();
    expect(welcomeBadge()).toHaveTextContent("🌱 Steady 3");
  });

  it("AC10 (#30): on a date tie the later badge in the order is shown", () => {
    localStorage.setItem(
      BADGES_KEY,
      JSON.stringify([
        { badgeId: "steady-3", earnedAt: "2026-10-05" },
        { badgeId: "first-step", earnedAt: "2026-10-05" },
      ]),
    );
    renderView();
    expect(welcomeBadge()).toHaveTextContent("🌱 Steady 3");
  });

  it("AC11 (#30): without an earned badge no icon is shown", () => {
    renderView();
    expect(welcomeBadge()).toBeNull();
  });

  it("AC12 (#30): earning a badge during the visit does not change the welcome icon", () => {
    localStorage.setItem(HABITS_KEY, JSON.stringify([habit]));
    localStorage.setItem(CHECKINS_KEY, JSON.stringify([]));
    renderView();
    fireEvent.click(screen.getByRole("checkbox", { name: "Done today: Run" }));
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(welcomeBadge()).toBeNull();
  });

  it("AC13 (#30): invalid JSON shows a non-blocking error and is not overwritten", () => {
    localStorage.setItem(PROFILE_KEY, "{nope");
    renderView();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(heading()).toHaveTextContent(/^Welcome$/);
    expect(storedProfile()).toBe("{nope");
    goTo("Habits");
    expect(storedProfile()).toBe("{nope");
    expect(screen.getByRole("button", { name: "Add name" })).toBeInTheDocument();
  });

  it("AC15 (#30): the nav still shows exactly Today, Week and Habits", () => {
    render(<HabitList />);
    const nav = screen.getByRole("navigation");
    expect(Array.from(nav.querySelectorAll("button")).map((b) => b.textContent)).toEqual([
      "Today",
      "Week",
      "Habits",
    ]);
  });

  it("AC16 (#30): the name field has a visible label and works by keyboard", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderView("Habits");
    await user.click(screen.getByRole("button", { name: "Add name" }));
    const field = screen.getByLabelText("Your name (optional)");
    expect(field).toHaveFocus();
    await user.keyboard("Kim{Enter}");
    goTo("Today");
    expect(heading()).toHaveTextContent("Welcome, Kim");
  });

  it("AC17 (#30): saving a name leaves the other stored data unchanged", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const habits = JSON.stringify([habit]);
    const checkins = JSON.stringify([{ habitId: "1", date: "2026-11-01" }]);
    const badges = JSON.stringify([{ badgeId: "first-step", earnedAt: "2026-11-01" }]);
    localStorage.setItem(HABITS_KEY, habits);
    localStorage.setItem(CHECKINS_KEY, checkins);
    localStorage.setItem(BADGES_KEY, badges);
    renderView("Habits");
    await user.click(screen.getByRole("button", { name: "Add name" }));
    await saveName(user, "Sam");
    expect(localStorage.getItem(HABITS_KEY)).toBe(habits);
    expect(localStorage.getItem(CHECKINS_KEY)).toBe(checkins);
    expect(localStorage.getItem(BADGES_KEY)).toBe(badges);
  });
});
