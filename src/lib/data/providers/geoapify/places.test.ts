import { describe, expect, it } from "vitest";
import { buildPlacesUrl, parsePlaces, INDUSTRY_GEOAPIFY_CATEGORIES } from "./places";

describe("buildPlacesUrl", () => {
  it("rejects without a province", () => {
    const result = buildPlacesUrl({ industry: "Retail" }, "key");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/province/i);
  });

  it("rejects without an industry -- unlike OSM, there's no keyword fallback", () => {
    const result = buildPlacesUrl({ province: "Gauteng" }, "key");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/industry/i);
  });

  it("rejects an industry with no category mapping", () => {
    const result = buildPlacesUrl({ province: "Gauteng", industry: "Not A Real Industry" }, "key");
    expect(result.ok).toBe(false);
  });

  it("builds a valid URL with categories, bbox filter, and limit", () => {
    const result = buildPlacesUrl({ province: "Gauteng", industry: "Retail" }, "test-key");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const url = new URL(result.url);
    expect(url.pathname).toBe("/v2/places");
    expect(url.searchParams.get("apiKey")).toBe("test-key");
    expect(url.searchParams.get("categories")).toBe(INDUSTRY_GEOAPIFY_CATEGORIES.Retail.join(","));
    expect(url.searchParams.get("filter")).toMatch(/^rect:/);
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.has("name")).toBe(false);
  });

  it("passes keywords through as the name param when given", () => {
    const result = buildPlacesUrl({ province: "Gauteng", industry: "Retail", keywords: "Kagiso" }, "key");
    expect(result.ok).toBe(true);
    if (result.ok) expect(new URL(result.url).searchParams.get("name")).toBe("Kagiso");
  });
});

describe("parsePlaces", () => {
  const feature = (props: Record<string, unknown>) => ({ properties: props });

  it("maps a feature to ProviderCompany, labeling industry/province with what was searched", () => {
    const payload = {
      features: [
        feature({ place_id: "abc123", name: "Kagiso Hardware", city: "Krugersdorp", formatted: "12 Main Rd, Krugersdorp" }),
      ],
    };
    const [company] = parsePlaces(payload, "Construction", "Gauteng");
    expect(company).toMatchObject({
      externalId: "abc123",
      source: "Geoapify",
      name: "Kagiso Hardware",
      industry: "Construction",
      province: "Gauteng",
      city: "Krugersdorp",
      address: "12 Main Rd, Krugersdorp",
      website: null,
      phone: null,
      email: null,
      registrationNumber: null,
      contact: null,
    });
  });

  it("prefers Geoapify's own returned state over the searched province when present", () => {
    const payload = { features: [feature({ place_id: "x", name: "Co", state: "Gauteng Province" })] };
    const [company] = parsePlaces(payload, "Retail", "Gauteng");
    expect(company.province).toBe("Gauteng Province");
  });

  it("skips features with no name or no place_id", () => {
    const payload = { features: [feature({ place_id: "x" }), feature({ name: "No ID" })] };
    expect(parsePlaces(payload, "Retail", "Gauteng")).toEqual([]);
  });

  it("returns an empty array for a malformed payload", () => {
    expect(parsePlaces({}, "Retail", "Gauteng")).toEqual([]);
    expect(parsePlaces(null, "Retail", "Gauteng")).toEqual([]);
  });
});
