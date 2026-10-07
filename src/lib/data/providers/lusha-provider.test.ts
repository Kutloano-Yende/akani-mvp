import { describe, expect, it } from "vitest";
import { buildFilters, mapEnriched, mapPreview } from "./lusha-provider";

// Shapes taken from Lusha's own V3 API docs and mock server
// (docs.lusha.com/apis/openapi/prospecting, .../enrich/enrichcompanies), 2026-09-28.
const preview = {
  id: "16303253",
  name: "Lusha",
  domain: "www.lusha.com",
  employeeCount: { exact: 364, min: 201, max: 500 },
  industry: "Technology, Information & Media",
  location: { city: "Boston", state: "Massachusetts", country: "United States", countryIso2: "US" },
  socialLinks: { linkedin: "https://www.linkedin.com/company/lushadata" },
  has: ["phones", "emails"],
};

// phones/emails shape confirmed against a REAL production enrich response,
// 2026-10-07 -- the docs/mock-server example above used singular "phone"/
// "email" strings, which turned out not to match what the live API actually
// sends (plural arrays), and every production import silently got null
// contact details as a result. See the git history for the bug this fixed.
const enriched = {
  id: "16303253",
  name: "Lusha",
  domain: "www.lusha.com",
  employeeCount: { exact: 364, min: 201, max: 500 },
  industry: "Technology, Information & Media",
  phones: [{ number: "(480) 729-6394" }],
  emails: [{ email: "info@lusha.com" }],
};

describe("buildFilters", () => {
  it("always searches South Africa", () => {
    const f = buildFilters({});
    expect(f.companies.include.locations).toEqual([{ country: "South Africa" }]);
  });

  it("adds province and city to the location filter", () => {
    const f = buildFilters({ province: "Gauteng", city: "Johannesburg" });
    expect(f.companies.include.locations).toEqual([
      { country: "South Africa", state: "Gauteng", city: "Johannesburg" },
    ]);
  });

  it("maps an employee range to a sizes filter", () => {
    const f = buildFilters({ employeesMin: 10, employeesMax: 200 });
    expect(f.companies.include.sizes).toEqual([{ min: 10, max: 200 }]);
  });

  it("omits sizes when no employee range is given", () => {
    expect(buildFilters({}).companies.include.sizes).toBeUndefined();
  });

  it("passes industry and keywords through as keywords (no id-mapping lookup)", () => {
    const f = buildFilters({ industry: "Construction", keywords: "roofing" });
    expect(f.companies.include.keywords).toEqual(["Construction", "roofing"]);
  });

  it("omits keywords entirely when neither is given", () => {
    expect(buildFilters({}).companies.include.keywords).toBeUndefined();
  });
});

describe("mapPreview", () => {
  it("maps a search result without phone/email/address (not in the preview)", () => {
    const c = mapPreview(preview);
    expect(c).toMatchObject({
      externalId: "16303253",
      source: "Lusha",
      name: "Lusha",
      website: "www.lusha.com",
      industry: "Technology, Information & Media",
      city: "Boston",
      employeeCount: 364,
      phone: null,
      email: null,
      address: null,
      registrationNumber: null,
      contact: null,
    });
  });

  it("prefers the exact employee count over the min/max range", () => {
    const c = mapPreview({ ...preview, employeeCount: { min: 201, max: 500 } });
    expect(c?.employeeCount).toBe(500);
  });

  it("normalizes South African province spelling", () => {
    const c = mapPreview({ ...preview, location: { state: "Kwazulu-natal" } });
    expect(c?.province).toBe("KwaZulu-Natal");
  });

  it("returns null without an id or name", () => {
    expect(mapPreview({ name: "No id" })).toBeNull();
    expect(mapPreview({ id: "1" })).toBeNull();
  });
});

describe("mapEnriched", () => {
  it("maps phone and email from the base (non-premium) enrich response", () => {
    const c = mapEnriched(enriched);
    expect(c).toMatchObject({
      externalId: "16303253",
      phone: "(480) 729-6394",
      email: "info@lusha.com",
      // Enrich doesn't repeat location; mergeCompany is what keeps the
      // province/city already known from the search step.
      province: null,
      city: null,
    });
  });

  it("returns null without an id or name", () => {
    expect(mapEnriched({})).toBeNull();
  });

  it("leaves phone/email null when a company has no entries in those arrays", () => {
    const c = mapEnriched({ ...enriched, phones: [], emails: undefined });
    expect(c).toMatchObject({ phone: null, email: null });
  });
});
