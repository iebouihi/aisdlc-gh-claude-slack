import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home page (foundation)", () => {
  it("renders the app title", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "Good habit tracker" })).toBeInTheDocument();
  });
});
