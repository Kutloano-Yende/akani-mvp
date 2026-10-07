import { describe, expect, it } from "vitest";
import { buildQuery, INDUSTRY_OSM_TAGS } from "./query";

describe("buildQuery", () => {
  it("rejects without a province -- confirmed against the real API that whole-country queries time out", () => {
    const result = buildQuery({ industry: "Retail" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/province/i);
  });

  it("rejects with a province but no industry or keyword", () => {
    const result = buildQuery({ province: "Gauteng" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/industry or a keyword/i);
  });

  it("scopes to the province's ISO3166-2 area, never whole-country", () => {
    const result = buildQuery({ province: "Gauteng", industry: "Retail" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.query).toContain('area["ISO3166-2"="ZA-GT"]');
      expect(result.query).not.toContain("ISO3166-1");
    }
  });

  it("emits one tag clause per mapped industry tag", () => {
    const result = buildQuery({ province: "Gauteng", industry: "Construction" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      for (const tag of INDUSTRY_OSM_TAGS.Construction) {
        const expected = tag.value ? `["${tag.key}"="${tag.value}"]` : `["${tag.key}"]`;
        expect(result.query).toContain(expected);
      }
    }
  });

  it("appends a case-insensitive name regex when a keyword is given", () => {
    const result = buildQuery({ province: "Gauteng", keywords: "Kagiso" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.query).toContain('["name"~"Kagiso",i]');
  });

  it("escapes regex metacharacters in the keyword", () => {
    const result = buildQuery({ province: "Gauteng", keywords: "A.B (Pty)" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.query).toContain('A\\.B \\(Pty\\)');
  });

  it("falls back to the generic core tag set for an unmapped industry when a keyword is given", () => {
    const result = buildQuery({ province: "Gauteng", keywords: "Something" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.query).toContain('["shop"]');
      expect(result.query).toContain('["office"]');
      expect(result.query).toContain('["craft"]');
    }
  });

  it("includes a conservative numeric output cap, not an unbounded result set", () => {
    const result = buildQuery({ province: "Gauteng", industry: "Retail" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.query).toMatch(/out center tags \d+;/);
  });
});
