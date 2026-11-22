import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Empty storage is a first run (#67). Tests start with the setup marked done, so they render the
// app; tests of the setup itself clear storage first (`localStorage.clear()`).
beforeEach(() => {
  localStorage.setItem("setup:v1", JSON.stringify({ done: true }));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
