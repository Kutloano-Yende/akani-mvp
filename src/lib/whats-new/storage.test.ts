import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isFresh, read, remove, write } from "./storage";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("storage helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: fakeStorage(), sessionStorage: fakeStorage() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads, writes and removes", () => {
    expect(read("k")).toBeNull();
    write("k", "v");
    expect(read("k")).toBe("v");
    remove("k");
    expect(read("k")).toBeNull();
  });

  it("keeps local and session storage separate", () => {
    write("k", "local");
    write("k", "session", "session");
    expect(read("k")).toBe("local");
    expect(read("k", "session")).toBe("session");
  });

  it("treats a timestamp as fresh only within the window", () => {
    write("t", String(Date.now() - 1000));
    expect(isFresh("t", 5000)).toBe(true);
    write("t", String(Date.now() - 10_000));
    expect(isFresh("t", 5000)).toBe(false);
    expect(isFresh("missing", 5000)).toBe(false);
    write("t", "not a number");
    expect(isFresh("t", 5000)).toBe(false);
  });
});

describe("when storage is blocked or unavailable", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("never throws, it just does nothing", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    });
    expect(() => write("k", "v")).not.toThrow();
    expect(read("k")).toBeNull();
    expect(() => remove("k")).not.toThrow();
    expect(isFresh("k", 1000)).toBe(false);
  });
});
