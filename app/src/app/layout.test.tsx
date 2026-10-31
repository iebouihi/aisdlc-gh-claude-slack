import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout, { metadata, viewport } from "./layout";

describe("Root layout", () => {
  it("AC3 (#7): the viewport is device-width with an initial scale of 1", () => {
    expect(viewport).toEqual({ width: "device-width", initialScale: 1 });
  });

  it("AC3 (#7): metadata has a title and a description", () => {
    expect(metadata.title).toBe("Good habit tracker");
    expect(metadata.description).toBeTruthy();
  });

  it("AC3 (#7): the layout renders its children inside the body", () => {
    const html = renderToString(
      <RootLayout>
        <p>child</p>
      </RootLayout>,
    );
    expect(html).toMatch(/<body[^>]*><p>child<\/p><\/body>/);
  });
});
