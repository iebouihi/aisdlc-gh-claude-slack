import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HabitList } from "./HabitList";
import { DEFAULT_ICON_EMOJI } from "@/lib/icons";
import { HABITS_KEY } from "@/lib/storage";

function seed(habits: unknown) {
  localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
}
const stored = () => JSON.parse(localStorage.getItem(HABITS_KEY) ?? "null");
const H = (id: string, name: string, icon?: string) => ({
  id,
  name,
  createdAt: `2026-01-0${id}T00:00:00.000Z`,
  ...(icon ? { icon } : {}),
});
const addInput = () => screen.getByRole("textbox", { name: "New habit name" });

async function add(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(addInput(), `${name}{Enter}`);
}

describe("HabitList", () => {
  afterEach(() => vi.restoreAllMocks());

  it("AC1 (#1): adds a habit with an icon via Enter and via the Add button, no toast", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    await user.click(screen.getByRole("button", { name: "Book" }));
    await add(user, "Read 20 min");
    expect(addInput()).toHaveValue("");
    await user.type(addInput(), "Run");
    await user.click(screen.getByRole("button", { name: "Add" }));
    const items = screen.getAllByRole("listitem");
    expect(items.map((i) => i.getAttribute("aria-label"))).toEqual(["Read 20 min", "Run"]);
    expect(items[0]).toHaveTextContent("📖");
    expect(stored()[0].icon).toBe("book");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("AC2 (#1): a habit without an icon shows the default icon", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    await add(user, "Stretch");
    expect(screen.getByRole("listitem")).toHaveTextContent(DEFAULT_ICON_EMOJI);
    expect("icon" in stored()[0]).toBe(false);
  });

  it("AC3 (#1): empty and over-long names show errors and save nothing", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    await user.type(addInput(), "   {Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a habit name.");
    await user.clear(addInput());
    await user.click(addInput());
    await user.paste("a".repeat(61));
    await user.keyboard("{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("Name must be 60 characters or fewer.");
    expect(localStorage.getItem(HABITS_KEY)).toBeNull();
  });

  it("AC4 (#1): 60 emoji are accepted and 61 are rejected", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    await user.click(addInput());
    await user.paste("😀".repeat(61));
    await user.keyboard("{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("Name must be 60 characters or fewer.");
    await user.clear(addInput());
    await user.paste("😀".repeat(60));
    await user.keyboard("{Enter}");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("AC5 (#1): a duplicate name is rejected", async () => {
    seed([H("1", "Read")]);
    const user = userEvent.setup();
    render(<HabitList />);
    await user.type(addInput(), " read {Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("You already have this habit.");
    expect(stored()).toHaveLength(1);
  });

  it("AC6 (#1): editing name and icon keeps id, createdAt and position", async () => {
    seed([H("1", "Read"), H("2", "Run")]);
    const user = userEvent.setup();
    render(<HabitList />);
    await user.click(screen.getByRole("button", { name: "Edit Read" }));
    const input = screen.getByRole("textbox", { name: "Name for Read" });
    await user.clear(input);
    await user.type(input, "Read books");
    await user.click(
      within(screen.getByRole("group", { name: /Icon for Read/ })).getByRole("button", {
        name: "Book",
      }),
    );
    await user.type(input, "{Enter}");
    expect(stored()).toEqual([
      { id: "1", name: "Read books", createdAt: "2026-01-01T00:00:00.000Z", icon: "book" },
      H("2", "Run"),
    ]);
    expect(screen.getByRole("button", { name: "Edit Read books" })).toHaveFocus();
  });

  it("AC7 (#1): saving with the same name (case or spacing) closes with no error", async () => {
    seed([H("1", "Read")]);
    const user = userEvent.setup();
    render(<HabitList />);
    await user.click(screen.getByRole("button", { name: "Edit Read" }));
    const input = screen.getByRole("textbox", { name: "Name for Read" });
    await user.clear(input);
    await user.type(input, "  READ {Enter}");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Name for/ })).not.toBeInTheDocument();
    expect(stored()[0].name).toBe("READ");
  });

  it("AC8 (#1): Escape or clicking away cancels the edit, name and icon restored", async () => {
    seed([H("1", "Read", "book")]);
    const user = userEvent.setup();
    render(<HabitList />);
    await user.click(screen.getByRole("button", { name: "Edit Read" }));
    await user.type(screen.getByRole("textbox", { name: "Name for Read" }), "ing{Escape}");
    expect(screen.getByRole("listitem", { name: "Read" })).toHaveTextContent("📖");
    expect(screen.getByRole("button", { name: "Edit Read" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Edit Read" }));
    await user.type(screen.getByRole("textbox", { name: "Name for Read" }), "ing");
    await user.click(document.body);
    expect(screen.getByRole("listitem", { name: "Read" })).toBeInTheDocument();
    expect(stored()[0].name).toBe("Read");
  });

  it("AC9 (#1): Delete while editing cancels the edit and opens the dialog for that habit", async () => {
    seed([H("1", "Read"), H("2", "Run")]);
    const user = userEvent.setup();
    render(<HabitList />);
    await user.click(screen.getByRole("button", { name: "Edit Read" }));
    await user.type(screen.getByRole("textbox", { name: "Name for Read" }), "ing");
    await user.click(screen.getByRole("button", { name: "Delete Run" }));
    expect(screen.queryByRole("textbox", { name: /Name for/ })).not.toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Read" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Run");
  });

  it("AC10 (#1): the dialog traps focus and Escape returns focus to the Delete button", async () => {
    seed([H("1", "Read")]);
    const user = userEvent.setup();
    render(<HabitList />);
    await user.click(screen.getByRole("button", { name: "Delete Read" }));
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 5; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Read" })).toHaveFocus();
    expect(stored()).toHaveLength(1);
  });

  it("AC11 (#1): confirming deletes permanently and focuses the next row, then the add input", async () => {
    seed([H("1", "Read"), H("2", "Run")]);
    const user = userEvent.setup();
    render(<HabitList />);
    await user.click(screen.getByRole("button", { name: "Delete Read" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(stored().map((h: { id: string }) => h.id)).toEqual(["2"]);
    expect(screen.getByRole("listitem", { name: "Run" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Delete Run" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(stored()).toEqual([]);
    expect(addInput()).toHaveFocus();
  });

  it("AC12 (#1): stored habits without an icon load with the default icon and no error", () => {
    seed([H("1", "Read")]);
    render(<HabitList />);
    expect(screen.getByRole("listitem")).toHaveTextContent(DEFAULT_ICON_EMOJI);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("AC13 (#1): an unknown stored icon shows the default icon and no error", () => {
    seed([H("1", "Read", "not-in-catalog")]);
    render(<HabitList />);
    expect(screen.getByRole("listitem")).toHaveTextContent(DEFAULT_ICON_EMOJI);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("AC14 (#1): a malformed entry shows an error, an empty list and no overwrite until save", async () => {
    const bad = [{ name: "No id" }];
    seed(bad);
    const user = userEvent.setup();
    render(<HabitList />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(stored()).toEqual(bad);
    await add(user, "Read");
    expect(stored()).toHaveLength(1);
    expect(stored()[0].name).toBe("Read");
  });

  it("AC15 (#1): unparseable data shows an error without crashing", () => {
    localStorage.setItem(HABITS_KEY, "{not json");
    render(<HabitList />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("No habits yet")).toBeInTheDocument();
  });

  it("AC15 (#1): a failed save shows the error and keeps the change for the session", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    await add(user, "Read");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Read" })).toBeInTheDocument();
  });

  it("AC15 (#1): unavailable localStorage shows an error without crashing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<HabitList />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("AC16 (#1): the empty state shows and its button focuses the add input", async () => {
    const user = userEvent.setup();
    render(<HabitList />);
    expect(screen.getByText("No habits yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add your first habit" }));
    expect(addInput()).toHaveFocus();
  });

  it("AC16 (#1): nothing is rendered in the list before storage is read", async () => {
    const { renderToString } = await import("react-dom/server");
    expect(renderToString(<HabitList />)).not.toContain("No habits yet");
  });

  it("AC17 (#1): picker options are labelled buttons reachable by keyboard; list icons are hidden", async () => {
    seed([H("1", "Read", "book")]);
    const user = userEvent.setup();
    render(<HabitList />);
    const group = screen.getByRole("group", { name: "Icon (optional)" });
    const options = within(group).getAllByRole("button");
    expect(options.length).toBeGreaterThanOrEqual(24);
    expect(within(group).getByRole("button", { name: "Water" })).toBeInTheDocument();
    within(group).getByRole("button", { name: "Water" }).focus();
    await user.keyboard("{Enter}");
    expect(within(group).getByRole("button", { name: "Water" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("listitem", { name: "Read" }).querySelector("[aria-hidden=true]"),
    ).toHaveTextContent("📖");
  });

  it("AC18 (#1): each row has Edit and Delete buttons named after the habit", () => {
    seed([H("1", "Read")]);
    render(<HabitList />);
    const row = screen.getByRole("listitem", { name: "Read" });
    expect(within(row).getByRole("button", { name: "Edit Read" })).toHaveTextContent("Edit");
    expect(within(row).getByRole("button", { name: "Delete Read" })).toHaveTextContent("Delete");
  });

  it("AC20 (#1): list, names, icons and order survive a reload", async () => {
    const user = userEvent.setup();
    const first = render(<HabitList />);
    await user.click(screen.getByRole("button", { name: "Run" }));
    await add(user, "Jog");
    await add(user, "Read");
    first.unmount();
    render(<HabitList />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((i) => i.getAttribute("aria-label"))).toEqual(["Jog", "Read"]);
    expect(items[0]).toHaveTextContent("🏃");
  });
});
