import { describe, expect, it } from "vitest";
import { WEEK_MS, cumulative, cumulativeSparkline, weeklySums } from "./trend";

describe("weeklySums", () => {
  it("counts one item per week by default", () => {
    const now = Date.parse("2026-01-29T00:00:00Z");
    const items = [
      { date: new Date(now - 0.5 * WEEK_MS) }, // this week
      { date: new Date(now - 1.5 * WEEK_MS) }, // last week
      { date: new Date(now - 1.2 * WEEK_MS) }, // last week too
    ];
    const result = weeklySums(items, 3, now);
    expect(result).toEqual([0, 2, 1]);
  });

  it("sums an explicit value instead of counting", () => {
    const now = Date.parse("2026-01-29T00:00:00Z");
    const items = [
      { date: new Date(now - 0.2 * WEEK_MS), value: 5 },
      { date: new Date(now - 0.1 * WEEK_MS), value: 3 },
    ];
    expect(weeklySums(items, 1, now)).toEqual([8]);
  });

  it("returns all zeros for an empty input", () => {
    expect(weeklySums([], 4, Date.now())).toEqual([0, 0, 0, 0]);
  });

  it("excludes items outside the requested window", () => {
    const now = Date.parse("2026-01-29T00:00:00Z");
    const items = [{ date: new Date(now - 10 * WEEK_MS) }];
    expect(weeklySums(items, 2, now)).toEqual([0, 0]);
  });
});

describe("cumulative", () => {
  it("produces a running total", () => {
    expect(cumulative([1, 2, 3])).toEqual([1, 3, 6]);
  });

  it("starts from a given total", () => {
    expect(cumulative([1, 2], 10)).toEqual([11, 13]);
  });

  it("returns an empty array for an empty input", () => {
    expect(cumulative([])).toEqual([]);
  });
});

describe("cumulativeSparkline", () => {
  it("ends at the true total, folding dates outside the window into the starting total", () => {
    const now = Date.parse("2026-01-29T00:00:00Z");
    const items = [
      { date: new Date(now - 20 * WEEK_MS) }, // well outside a 2-week window
      { date: new Date(now - 0.5 * WEEK_MS) }, // this week
    ];
    const result = cumulativeSparkline(items, 2, now);
    expect(result).toEqual([1, 2]);
  });

  it("is a plain running count when every date is inside the window", () => {
    const now = Date.parse("2026-01-29T00:00:00Z");
    const items = [{ date: new Date(now - 1.5 * WEEK_MS) }, { date: new Date(now - 0.2 * WEEK_MS) }];
    expect(cumulativeSparkline(items, 2, now)).toEqual([1, 2]);
  });

  it("sums an explicit value instead of counting, folding pre-window sums into the starting total", () => {
    const now = Date.parse("2026-01-29T00:00:00Z");
    const items = [
      { date: new Date(now - 20 * WEEK_MS), value: 100 },
      { date: new Date(now - 0.5 * WEEK_MS), value: 5 },
    ];
    expect(cumulativeSparkline(items, 2, now)).toEqual([100, 105]);
  });

  it("returns all zeros for no dates at all", () => {
    expect(cumulativeSparkline([], 3, Date.now())).toEqual([0, 0, 0]);
  });
});
