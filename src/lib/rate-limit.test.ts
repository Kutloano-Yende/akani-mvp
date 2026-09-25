import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allows up to the limit then blocks, reporting how long to wait", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("k1", 3, 1000).allowed).toBe(true);
    const blocked = rateLimit("k1", 3, 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(1000);
  });

  it("resets once the window passes", () => {
    rateLimit("k2", 1, 1000);
    expect(rateLimit("k2", 1, 1000).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rateLimit("k2", 1, 1000).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    rateLimit("a", 1, 1000);
    expect(rateLimit("a", 1, 1000).allowed).toBe(false);
    expect(rateLimit("b", 1, 1000).allowed).toBe(true);
  });
});
