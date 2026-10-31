import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HABITS_KEY, readJson, writeJson } from "./storage";

describe("storage helper", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("AC6 (#7): a JSON value written under a key is read back unchanged", () => {
    const value = { a: [1, 2, { b: "c" }], d: null };
    expect(writeJson(HABITS_KEY, value)).toEqual({ ok: true, value: true });
    expect(readJson(HABITS_KEY)).toEqual({ ok: true, value });
  });

  it("AC6 (#7): the versioned key is habits:v1 and a missing key reads as null", () => {
    expect(HABITS_KEY).toBe("habits:v1");
    expect(readJson("missing")).toEqual({ ok: true, value: null });
  });

  it("AC7 (#7): a throwing read returns a failure result", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readJson("k")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("AC7 (#7): a throwing write (quota exceeded) returns a failure result", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(writeJson("k", 1)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("AC7 (#7): blocked access to localStorage itself returns a failure result", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(readJson("k").ok).toBe(false);
    expect(writeJson("k", 1).ok).toBe(false);
  });

  it("AC6 (#7): primitives, arrays and a stored null round-trip", () => {
    for (const value of [0, "text", false, [1, "a"]]) {
      writeJson("k", value);
      expect(readJson("k")).toEqual({ ok: true, value });
    }
    writeJson("k", null);
    expect(readJson("k")).toEqual({ ok: true, value: null });
  });

  it("AC6 (#7): writing again under the same key replaces the previous value", () => {
    writeJson("k", { v: 1 });
    writeJson("k", { v: 2 });
    expect(readJson("k")).toEqual({ ok: true, value: { v: 2 } });
  });

  it("AC6 (#7): the value is stored as JSON text under the exact key", () => {
    writeJson(HABITS_KEY, { v: 1 });
    expect(window.localStorage.getItem(HABITS_KEY)).toBe('{"v":1}');
  });

  it("AC7 (#7): a value that cannot be serialized returns a failure result and stores nothing", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(writeJson("k", circular).ok).toBe(false);
    expect(window.localStorage.getItem("k")).toBeNull();
  });

  it("AC8 (#7): invalid JSON under the key returns a failure result", () => {
    window.localStorage.setItem("k", "{not json");
    expect(readJson("k")).toEqual({ ok: false, reason: "corrupted" });
  });
});
