import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HabitList } from "./HabitList";
import { CHECKINS_KEY, HABITS_KEY, MOOD_KEY } from "@/lib/storage";

// Saturday 21 Nov 2026, local time.
const NOW = new Date(2026, 10, 21, 12);
const habit = (id: string, name: string, extra: object = {}) => ({
  id,
  name,
  createdAt: new Date(2026, 0, 5, 12).toISOString(),
  frequency: { type: "daily" },
  startDate: "2026-01-05",
  ...extra,
});
const seed = (habits: unknown, checkins?: unknown, moods?: unknown) => {
  localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  if (checkins !== undefined) localStorage.setItem(CHECKINS_KEY, JSON.stringify(checkins));
  if (moods !== undefined) localStorage.setItem(MOOD_KEY, JSON.stringify(moods));
};
const storedMoods = () => JSON.parse(localStorage.getItem(MOOD_KEY) ?? "null");
const level = (name: string) => screen.getByRole("radio", { name: new RegExp(`${name}$`) });
const daySelect = () => screen.getByRole("combobox", { name: "Day" });
const ERROR = /Your mood entries could not be loaded or saved/;

// Moods for 7 days, 2026-11-15 .. 2026-11-09, plus check-ins for "Walk" on the first four.
const dayStr = (n: number) => `2026-11-${String(21 - n).padStart(2, "0")}`;
const sevenMoods = [5, 5, 5, 5, 1, 1, 1].map((value, i) => ({ date: dayStr(i + 1), value }));
const walkChecks = [1, 2, 3, 4].map((i) => ({ habitId: "1", date: dayStr(i) }));

describe("HabitList mood", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("AC1 (#53): five labelled mood buttons with emoji sit next to the summary above the list", () => {
    seed([habit("1", "Walk")]);
    render(<HabitList />);
    const group = screen.getByRole("group", { name: "How is your mood?" });
    expect(within(group).getAllByRole("radio")).toHaveLength(5);
    for (const l of ["Very low", "Low", "Okay", "High", "Very high"]) {
      expect(within(group).getByText(l)).toBeInTheDocument();
    }
    expect(group).toHaveTextContent("😞");
    const summary = screen.getByText("0 of 1 done today");
    const list = screen.getByRole("list");
    expect(summary.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(group.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("AC2 (#53): tapping a level saves it at once for the day, with no confirm or toast", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Walk")]);
    render(<HabitList />);
    await user.click(level("High"));
    expect(level("High")).toBeChecked();
    expect(storedMoods()).toEqual([{ date: "2026-11-21", value: 4 }]);
    expect(screen.queryByRole("status", { name: /saved/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("AC3 (#53): tapping another level replaces the value, with one entry for the date", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Walk")], undefined, [{ date: "2026-11-21", value: 2 }]);
    render(<HabitList />);
    expect(level("Low")).toBeChecked();
    await user.click(level("Very high"));
    expect(storedMoods()).toEqual([{ date: "2026-11-21", value: 5 }]);
  });

  it("AC4 (#53): Clear removes the entry and leaves no level selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Walk")], undefined, [{ date: "2026-11-21", value: 2 }]);
    render(<HabitList />);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(storedMoods()).toEqual([]);
    for (const r of screen.getAllByRole("radio")) expect(r).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("AC5 (#53): the day selector offers exactly 6 days, none older", () => {
    seed([habit("1", "Walk")]);
    render(<HabitList />);
    const options = within(daySelect()).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Today",
      "Yesterday",
      "2026-11-19",
      "2026-11-18",
      "2026-11-17",
      "2026-11-16",
    ]);
  });

  it("AC6 (#53): a mood on a previous day is saved for that date and changes no check-in", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Walk")], []);
    render(<HabitList />);
    await user.selectOptions(daySelect(), "2026-11-18");
    await user.click(level("Okay"));
    expect(storedMoods()).toEqual([{ date: "2026-11-18", value: 3 }]);
    expect(JSON.parse(localStorage.getItem(CHECKINS_KEY) ?? "[]")).toEqual([]);
    await user.selectOptions(daySelect(), "0");
    expect(level("Okay")).not.toBeChecked();
  });

  it("AC7 (#53): the habit row only has today's check control, whatever day the mood shows", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Walk")], []);
    render(<HabitList />);
    await user.selectOptions(daySelect(), "2026-11-18");
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    await user.click(screen.getByRole("checkbox", { name: "Done today: Walk" }));
    expect(JSON.parse(localStorage.getItem(CHECKINS_KEY) ?? "[]")).toEqual([
      { habitId: "1", date: "2026-11-21" },
    ]);
  });

  it("AC8 (#53): fewer than 7 days shows Not enough data yet and the progress, no habit rows", () => {
    seed([habit("1", "Walk")], [], sevenMoods.slice(0, 4));
    render(<HabitList />);
    const insights = screen.getByRole("region", { name: "Insights" });
    expect(insights).toHaveTextContent("Not enough data yet");
    expect(insights).toHaveTextContent("4 of 7 days logged");
    expect(within(insights).queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("AC9 (#53): with enough data a habit shows its difference and based on N days", () => {
    seed([habit("1", "Walk")], walkChecks, sevenMoods);
    render(<HabitList />);
    const insights = screen.getByRole("region", { name: "Insights" });
    expect(insights).toHaveTextContent("+4.0 on days done");
    expect(insights).toHaveTextContent("based on 7 days");
  });

  it("AC15 (#53): the note and the not-done statement are visible, in text", () => {
    seed([habit("1", "Walk")]);
    render(<HabitList />);
    const insights = screen.getByRole("region", { name: "Insights" });
    expect(insights).toHaveTextContent(
      "These are patterns in your own data. A link doesn't mean a habit causes better mood.",
    );
    expect(insights).toHaveTextContent('Days without a check-in count as "not done"');
  });

  it("AC17 (#53): the Insights update at once after a mood change or a toggle, with no toast", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Walk")], walkChecks, sevenMoods.slice(0, 6));
    render(<HabitList />);
    const insights = screen.getByRole("region", { name: "Insights" });
    expect(insights).toHaveTextContent("6 of 7 days logged");
    await user.click(level("Very high"));
    expect(insights).toHaveTextContent("+");
    expect(insights).toHaveTextContent("based on 7 days");
    expect(insights).toHaveTextContent("tends to go with");
    // Checking today leaves only 2 not-done days: the habit no longer has enough data.
    await user.click(screen.getByRole("checkbox", { name: "Done today: Walk" }));
    expect(insights).toHaveTextContent("Not enough data yet");
    expect(insights).not.toHaveTextContent("based on");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("AC18 (#53): a deleted habit leaves the Insights and all moods stay stored", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Walk")], walkChecks, sevenMoods);
    render(<HabitList />);
    fireEvent.click(screen.getByRole("button", { name: "Habits" }));
    await user.click(screen.getByRole("button", { name: /Delete/ }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Delete/ }));
    expect(storedMoods()).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.queryByRole("region", { name: "Insights" })).not.toBeInTheDocument();
  });

  it("AC19 (#53): a renamed habit keeps its data under the new name", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Walk")], walkChecks, sevenMoods);
    render(<HabitList />);
    fireEvent.click(screen.getByRole("button", { name: "Habits" }));
    await user.click(screen.getByRole("button", { name: /Edit/ }));
    const input = screen.getByDisplayValue("Walk");
    await user.clear(input);
    await user.type(input, "Stroll");
    await user.click(screen.getByRole("button", { name: /Save/ }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    const insights = screen.getByRole("region", { name: "Insights" });
    expect(insights).toHaveTextContent("Stroll");
    expect(insights).toHaveTextContent("+4.0 on days done");
  });

  it("AC20 (#53): moods are shown again after a reload and habits/checkins are unchanged", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Walk")], []);
    const habitsBefore = localStorage.getItem(HABITS_KEY);
    const checkinsBefore = localStorage.getItem(CHECKINS_KEY);
    const first = render(<HabitList />);
    await user.click(level("High"));
    first.unmount();
    render(<HabitList />);
    expect(level("High")).toBeChecked();
    expect(localStorage.getItem(HABITS_KEY)).toBe(habitsBefore);
    expect(localStorage.getItem(CHECKINS_KEY)).toBe(checkinsBefore);
  });

  it("AC21 (#53): corrupted mood data shows a non-blocking error and is not overwritten", () => {
    seed([habit("1", "Walk")]);
    localStorage.setItem(MOOD_KEY, "{not json");
    render(<HabitList />);
    expect(screen.getByRole("alert")).toHaveTextContent(ERROR);
    expect(screen.getByRole("group", { name: "How is your mood?" })).toBeInTheDocument();
    expect(localStorage.getItem(MOOD_KEY)).toBe("{not json");
    for (const r of screen.getAllByRole("radio")) expect(r).not.toBeChecked();
  });

  it("AC22 (#53): a failed save shows the error and keeps the change for the session", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Walk")]);
    render(<HabitList />);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    await user.click(level("Low"));
    expect(screen.getByRole("alert")).toHaveTextContent(ERROR);
    expect(level("Low")).toBeChecked();
  });

  it("AC23 (#53): native radios in a group, a labelled select and a button, all with text labels", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed([habit("1", "Walk")]);
    render(<HabitList />);
    const group = screen.getByRole("group", { name: "How is your mood?" });
    const radios = within(group).getAllByRole("radio");
    for (const r of radios) {
      expect(r).toHaveAttribute("name", "mood");
      expect(r).toHaveAccessibleName(/\S/);
    }
    radios[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(radios[1]).toBeChecked();
    expect(daySelect()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("AC24 (#53): the mood and Insights styles wrap and never force horizontal scroll", () => {
    const dir = join(__dirname);
    const picker = readFileSync(join(dir, "MoodPicker.module.css"), "utf8");
    const insights = readFileSync(join(dir, "Insights.module.css"), "utf8");
    expect(picker).toMatch(/\.levels\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(picker).toMatch(/\.mood\s*\{[^}]*min-width:\s*0/);
    expect(insights).toMatch(/\.row\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(insights).toMatch(/\.insights\s*\{[^}]*min-width:\s*0/);
  });

  it("AC25 (#53): no network request is made while using mood and Insights", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    seed([habit("1", "Walk")], walkChecks, sevenMoods);
    render(<HabitList />);
    await user.click(level("High"));
    await act(async () => {});
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
