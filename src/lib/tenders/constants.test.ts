import { describe, expect, it } from "vitest";
import { bbeeOrFilter, BBEE_KEYWORDS } from "./constants";

describe("bbeeOrFilter", () => {
  it("builds a title/description ilike clause for every keyword", () => {
    const filter = bbeeOrFilter();
    for (const term of BBEE_KEYWORDS) {
      expect(filter).toContain(`title.ilike.%${term}%`);
      expect(filter).toContain(`description.ilike.%${term}%`);
    }
  });

  it("never includes the bare word BEE -- too short, too many false positives", () => {
    expect(bbeeOrFilter().toLowerCase()).not.toContain("ilike.%bee%");
  });

  it("joins clauses with commas, no trailing comma", () => {
    const filter = bbeeOrFilter();
    expect(filter.endsWith(",")).toBe(false);
    expect(filter.split(",")).toHaveLength(BBEE_KEYWORDS.length * 2);
  });
});
