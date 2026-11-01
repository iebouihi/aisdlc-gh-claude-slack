import { fireEvent, render, screen } from "@testing-library/react";
import { HabitList } from "./HabitList";

export type ViewName = "Today" | "Week" | "Habits";

/** Switch the in-page view through the nav (the same click a person makes). */
export function goTo(view: ViewName) {
  fireEvent.click(screen.getByRole("button", { name: view }));
}

/** Render the app and open one view. Today is already shown on load. */
export function renderView(view: ViewName = "Today") {
  const result = render(<HabitList />);
  if (view !== "Today") goTo(view);
  return result;
}
