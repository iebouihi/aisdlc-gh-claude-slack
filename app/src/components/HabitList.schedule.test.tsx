import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HabitList } from "./HabitList";
import { HABITS_KEY } from "@/lib/storage";
import { toLocalDate } from "@/lib/schedule";

type Scope = Pick<typeof screen, "getByLabelText">;

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toLocalDate(d);
};
const seed = (habits: unknown) => localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
const stored = () => JSON.parse(localStorage.getItem(HABITS_KEY) ?? "null");
const habit = (extra: object = {}) => ({
  id: "1",
  name: "Read",
  createdAt: new Date(2026, 0, 5, 12).toISOString(),
  frequency: { type: "daily" },
  startDate: "2026-01-05",
  ...extra,
});
const startInput = (scope: Scope = screen) => scope.getByLabelText("Start date");
const endInput = (scope: Scope = screen) => scope.getByLabelText("End date (optional)");
const setDate = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });

async function typeName(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByRole("textbox", { name: "New habit name" }), name);
}
async function startEdit(user: ReturnType<typeof userEvent.setup>, name = "Read") {
  await user.click(screen.getByRole("button", { name: `Edit ${name}` }));
  return screen.getByRole("textbox", { name: `Name for ${name}` }).closest("form")!;
}

describe("HabitList schedule", () => {
  afterEach(() => vi.restoreAllMocks());

  it("AC1 (#15): the add form starts Daily, from today, with no end date", async () => {
    render(<HabitList />);
    expect(screen.getByRole("radio", { name: "Daily" })).toBeChecked();
    expect(startInput()).toHaveValue(day(0));
    expect(endInput()).toHaveValue("");
  });

  it("AC2 (#15): choosing Specific weekdays shows Mon–Sun checkboxes", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Specific weekdays" }));
    expect(screen.getAllByRole("checkbox").map((c) => c.getAttribute("aria-label"))).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    await user.click(screen.getByRole("checkbox", { name: "Monday" }));
    expect(screen.getByRole("checkbox", { name: "Monday" })).toBeChecked();
  });

  it("AC3 (#15): a start date in the past shows the error and saves nothing", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    await typeName(user, "Run");
    setDate(startInput(), day(-1));
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Start date can't be in the past.");
    expect(stored()).toBeNull();
  });

  it("AC4 (#15): an end date before the start date is rejected when adding and editing", async () => {
    const user = userEvent.setup();
    seed([habit()]);
    render(<HabitList />);
    await typeName(user, "Run");
    setDate(startInput(), day(2));
    setDate(endInput(), day(1));
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "End date must be on or after the start date.",
    );
    expect(stored()).toHaveLength(1);

    const form = await startEdit(user);
    setDate(endInput(within(form)), "2026-01-01");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(within(form).getByRole("alert")).toHaveTextContent(
      "End date must be on or after the start date.",
    );
    expect(stored()[0]).not.toHaveProperty("endDate");
  });

  it("AC5 (#15): weekdays with no day ticked shows an inline error and saves nothing", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    await typeName(user, "Run");
    await user.click(screen.getByRole("radio", { name: "Specific weekdays" }));
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Pick at least one day.");
    expect(stored()).toBeNull();
  });

  it("AC6 (#15): a saved habit shows its summary and keeps it after a reload", async () => {
    const user = userEvent.setup();
    const first = render(<HabitList />);
    await typeName(user, "Run");
    await user.click(screen.getByRole("radio", { name: "Specific weekdays" }));
    for (const d of ["Friday", "Monday", "Wednesday"]) {
      await user.click(screen.getByRole("checkbox", { name: d }));
    }
    setDate(startInput(), day(3));
    setDate(endInput(), day(10));
    await user.click(screen.getByRole("button", { name: "Add" }));
    const pattern = /Mon, Wed, Fri · \d+ \w{3} – \d+ \w{3}/;
    expect(screen.getByRole("listitem")).toHaveTextContent(pattern);
    first.unmount();
    render(<HabitList />);
    expect(screen.getByRole("listitem")).toHaveTextContent(pattern);
    expect(stored()[0]).toMatchObject({
      frequency: { type: "weekdays", days: [1, 3, 5] },
      startDate: day(3),
      endDate: day(10),
    });
  });

  it("AC7 (#15): a habit without an end date has no end in its summary and is never Ended", () => {
    seed([habit()]);
    render(<HabitList />);
    expect(screen.getByRole("listitem")).toHaveTextContent("Daily · from 5 Jan");
    expect(screen.queryByText(/Ended/)).not.toBeInTheDocument();
  });

  it("AC8 (#15): editing only the name of a habit with a past start date saves", async () => {
    const user = userEvent.setup();
    seed([habit()]);
    render(<HabitList />);
    const form = await startEdit(user);
    const name = within(form).getByRole("textbox", { name: "Name for Read" });
    await user.clear(name);
    await user.type(name, "Read more");
    await user.click(within(form).getByRole("radio", { name: "Specific weekdays" }));
    await user.click(within(form).getByRole("checkbox", { name: "Sunday" }));
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(stored()[0]).toMatchObject({
      name: "Read more",
      startDate: "2026-01-05",
      frequency: { type: "weekdays", days: [0] },
    });
  });

  it("AC9 (#15): changing the start date to the past when editing is rejected", async () => {
    const user = userEvent.setup();
    seed([habit()]);
    render(<HabitList />);
    const form = await startEdit(user);
    setDate(startInput(within(form)), "2026-01-06");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Start date can't be in the past.");
    expect(stored()[0].startDate).toBe("2026-01-05");
  });

  it("AC10 (#15): changing the end date to the past when editing is rejected", async () => {
    const user = userEvent.setup();
    seed([habit()]);
    render(<HabitList />);
    const form = await startEdit(user);
    setDate(endInput(within(form)), "2026-01-10");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("End date can't be in the past.");
    expect(stored()[0]).not.toHaveProperty("endDate");
  });

  it("AC11 (#15): a habit whose end date has passed stays in the list as Ended", () => {
    seed([habit({ endDate: "2026-01-10" })]);
    render(<HabitList />);
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Daily · 5 Jan – 10 Jan");
    expect(item).toHaveTextContent("Ended 10 Jan");
  });

  it("AC12 (#15): a legacy habit shows as Daily from its createdAt date, with no error", () => {
    seed([{ id: "1", name: "Read", createdAt: new Date(2026, 0, 5, 12).toISOString() }]);
    render(<HabitList />);
    expect(screen.getByRole("listitem")).toHaveTextContent("Daily · from 5 Jan");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("AC13 (#15): a malformed schedule shows the corrupted-data message and an empty list", () => {
    seed([habit({ startDate: "tomorrow" })]);
    render(<HabitList />);
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("AC14 (#15): every schedule input has a label and errors are announced", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    expect(screen.getByRole("group", { name: "Frequency" })).toBeInTheDocument();
    expect(screen.getByLabelText("Start date")).toBeInTheDocument();
    expect(screen.getByLabelText("End date (optional)")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Specific weekdays" }));
    expect(screen.getByRole("group", { name: "Days of the week" })).toBeInTheDocument();
    await typeName(user, "Run");
    setDate(startInput(), day(-1));
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(startInput()).toHaveAttribute("aria-invalid", "true");
    expect(startInput()).toHaveAccessibleDescription("Start date can't be in the past.");
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });

  it("AC15 (#15): stored schedule uses the documented shape", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    await typeName(user, "Run");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(stored()[0].frequency).toEqual({ type: "daily" });
    expect(stored()[0].startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(stored()[0]).not.toHaveProperty("endDate");
  });
});
