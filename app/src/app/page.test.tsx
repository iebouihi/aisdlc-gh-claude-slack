import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "./page";
import RootLayout from "./layout";

describe("Home page (foundation)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("AC1 (#7): the home page shows the app title", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Good habit tracker" }),
    ).toBeInTheDocument();
  });

  it("AC3 (#7): the root layout sets lang=en", () => {
    const html = renderToString(
      <RootLayout>
        <Home />
      </RootLayout>,
    );
    expect(html).toContain('<html lang="en"');
  });

  it("AC9 (#7): server rendering never accesses localStorage", () => {
    const get = vi.spyOn(Storage.prototype, "getItem");
    const set = vi.spyOn(Storage.prototype, "setItem");
    renderToString(
      <RootLayout>
        <Home />
      </RootLayout>,
    );
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
});
