import { describe, expect, it } from "vitest";
import {
  clamp,
  computePopoverPosition,
  padRect,
  shouldOfferRelease,
  stepsForRole,
  type Release,
} from "./tour";
import { RELEASE } from "./release";

const release: Release = {
  id: "r1",
  steps: [
    { id: "a", title: "A", body: "" },
    { id: "b", title: "B", body: "", roles: ["admin"] },
    { id: "c", title: "C", body: "", roles: ["admin", "manager"] },
  ],
};

describe("stepsForRole", () => {
  it("hides steps meant for other roles", () => {
    expect(stepsForRole(release, "sales").map((s) => s.id)).toEqual(["a"]);
    expect(stepsForRole(release, "manager").map((s) => s.id)).toEqual(["a", "c"]);
    expect(stepsForRole(release, "admin").map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});

describe("shouldOfferRelease", () => {
  it("offers an unseen release and not one already seen", () => {
    expect(shouldOfferRelease(null, release, "sales")).toBe(true);
    expect(shouldOfferRelease("older", release, "sales")).toBe(true);
    expect(shouldOfferRelease("r1", release, "sales")).toBe(false);
  });

  it("offers nothing when there are no steps for the role", () => {
    const adminOnly: Release = { id: "x", steps: [{ id: "b", title: "", body: "", roles: ["admin"] }] };
    expect(shouldOfferRelease(null, adminOnly, "sales")).toBe(false);
  });
});

describe("the shipped release", () => {
  it("has unique step ids, and every step has text", () => {
    const ids = RELEASE.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of RELEASE.steps) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
    }
  });

  it("gives every role at least one step", () => {
    for (const role of ["admin", "manager", "sales"]) {
      expect(stepsForRole(RELEASE, role).length).toBeGreaterThan(1);
    }
  });

  it("only shows the booking-settings step to people who can change them", () => {
    expect(stepsForRole(RELEASE, "sales").some((s) => s.id === "booking")).toBe(false);
    expect(stepsForRole(RELEASE, "manager").some((s) => s.id === "booking")).toBe(true);
    expect(stepsForRole(RELEASE, "admin").some((s) => s.id === "booking")).toBe(true);
  });

  it("points every target at an element that exists in the app", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : /\.(tsx|ts)$/.test(f) && !f.includes(".test.") ? [p] : [];
      });
    const source = walk("src").map((f) => readFileSync(f, "utf8")).join("\n");
    const targets = RELEASE.steps.map((s) => s.target).filter((t): t is string => !!t);
    for (const t of targets) {
      // A target may be written literally (data-tour="x") or via a `tour: "x"` field.
      expect(source.includes(`data-tour="${t}"`) || source.includes(`tour: "${t}"`)).toBe(true);
    }
  });
});

describe("clamp and padRect", () => {
  it("clamps into a range, tolerating an inverted one", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
    expect(clamp(5, 10, 0)).toBe(10);
  });

  it("grows a rect evenly on every side", () => {
    expect(padRect({ top: 10, left: 20, width: 100, height: 40 }, 6)).toEqual({
      top: 4,
      left: 14,
      width: 112,
      height: 52,
    });
  });
});

describe("computePopoverPosition", () => {
  const viewport = { width: 1000, height: 700 };
  const popover = { width: 300, height: 160 };

  it("centres the card when there is no target", () => {
    expect(computePopoverPosition(null, popover, viewport)).toEqual({ top: 270, left: 350, placement: "center" });
  });

  it("prefers below the target, centred on it", () => {
    const p = computePopoverPosition({ top: 100, left: 400, width: 100, height: 40 }, popover, viewport);
    expect(p.placement).toBe("bottom");
    expect(p.top).toBe(154);
    expect(p.left).toBe(300);
  });

  it("flips above when there is no room below", () => {
    const p = computePopoverPosition({ top: 600, left: 400, width: 100, height: 40 }, popover, viewport);
    expect(p.placement).toBe("top");
    expect(p.top).toBe(600 - 14 - 160);
  });

  it("goes beside a tall target that leaves no room above or below", () => {
    const p = computePopoverPosition({ top: 20, left: 10, width: 200, height: 660 }, popover, viewport);
    expect(p.placement).toBe("right");
    expect(p.left).toBe(224);
  });

  it("stays inside the viewport near an edge", () => {
    const p = computePopoverPosition({ top: 100, left: 960, width: 30, height: 30 }, popover, viewport);
    expect(p.left + popover.width).toBeLessThanOrEqual(viewport.width - 12);
    expect(p.left).toBeGreaterThanOrEqual(12);
  });

  it("still fits on a phone-sized screen", () => {
    const phone = { width: 375, height: 640 };
    const p = computePopoverPosition({ top: 20, left: 300, width: 40, height: 40 }, { width: 340, height: 200 }, phone);
    expect(p.left).toBeGreaterThanOrEqual(12);
    expect(p.left + 340).toBeLessThanOrEqual(375 - 12);
    expect(p.top + 200).toBeLessThanOrEqual(640 - 12);
  });
});
