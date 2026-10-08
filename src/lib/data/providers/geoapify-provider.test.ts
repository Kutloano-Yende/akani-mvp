import { describe, expect, it, vi, afterEach } from "vitest";
import { GeoapifyProvider, GeoapifyValidationError } from "./geoapify-provider";

vi.mock("./osm/website-scraper", () => ({
  findPublicEmails: vi.fn(),
}));
vi.mock("./osm/hunter", () => ({
  domainSearch: vi.fn(),
  verifyEmail: vi.fn(),
}));

import { findPublicEmails } from "./osm/website-scraper";
import { domainSearch, verifyEmail } from "./osm/hunter";

const company = {
  externalId: "place-1",
  source: "Geoapify",
  name: "Example Co",
  registrationNumber: null,
  industry: "Construction",
  province: "Gauteng",
  city: "Johannesburg",
  employeeCount: null,
  revenueRange: null,
  website: null,
  phone: null,
  email: null,
  address: null,
  contact: null,
};

describe("GeoapifyProvider.search", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects without calling the network when the query is invalid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new GeoapifyProvider("key");
    await expect(provider.search({ industry: "Retail" })).rejects.toThrow(GeoapifyValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns parsed companies for a valid, scoped search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ features: [{ properties: { place_id: "p1", name: "Example Co" } }] }),
      }) as Response),
    );
    const provider = new GeoapifyProvider("key");
    const results = await provider.search({ province: "Gauteng", industry: "Construction" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Example Co");
    expect(results[0].email).toBeNull();
  });

  it("filters results by city after parsing, not before", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          features: [
            { properties: { place_id: "p1", name: "In Joburg", city: "Johannesburg" } },
            { properties: { place_id: "p2", name: "In Pretoria", city: "Pretoria" } },
          ],
        }),
      }) as Response),
    );
    const provider = new GeoapifyProvider("key");
    const results = await provider.search({ province: "Gauteng", industry: "Retail", city: "johannesburg" });
    expect(results.map((r) => r.name)).toEqual(["In Joburg"]);
  });

  it("maps a 401 to a clear api-key error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ message: "Invalid API key" }) }) as Response),
    );
    const provider = new GeoapifyProvider("bad-key");
    await expect(provider.search({ province: "Gauteng", industry: "Retail" })).rejects.toThrow(/api key/i);
  });
});

describe("GeoapifyProvider.enrich", () => {
  afterEach(() => vi.clearAllMocks());

  it("fills contact fields from Place Details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          features: [{ properties: { contact: { email: "info@example.co.za" }, website: "https://example.co.za" } }],
        }),
      }) as Response),
    );
    const provider = new GeoapifyProvider("key");
    const result = await provider.enrich(company);
    expect(result?.email).toBe("info@example.co.za");
    expect(result?.website).toBe("https://example.co.za");
    expect(findPublicEmails).not.toHaveBeenCalled();
  });

  it("falls through to the website scrape when Place Details has no email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ features: [{ properties: { website: "https://example.co.za" } }] }),
      }) as Response),
    );
    vi.mocked(findPublicEmails).mockResolvedValue([{ email: "info@example.co.za", pageUrl: "x", type: "generic" }]);
    const provider = new GeoapifyProvider("key");
    const result = await provider.enrich(company);
    expect(result?.email).toBe("info@example.co.za");
  });

  it("falls through to Hunter only when the scrape also finds nothing and a key is configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ features: [{ properties: { website: "https://example.co.za" } }] }),
      }) as Response),
    );
    vi.mocked(findPublicEmails).mockResolvedValue([]);
    vi.mocked(domainSearch).mockResolvedValue([{ value: "info@example.co.za", type: "generic" }]);
    vi.mocked(verifyEmail).mockResolvedValue({ status: "valid" });

    const provider = new GeoapifyProvider("key", "hunter-key");
    const result = await provider.enrich(company);
    expect(result?.email).toBe("info@example.co.za");
    expect(domainSearch).toHaveBeenCalledWith("hunter-key", "example.co.za");
  });

  it("works correctly with Hunter entirely unconfigured -- stays optional", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ features: [{ properties: { website: "https://example.co.za" } }] }),
      }) as Response),
    );
    vi.mocked(findPublicEmails).mockResolvedValue([]);
    const provider = new GeoapifyProvider("key");
    const result = await provider.enrich(company);
    expect(result?.email).toBeNull();
    expect(domainSearch).not.toHaveBeenCalled();
  });

  it("never throws even when Place Details, the scrape, and Hunter all fail", async () => {
    // Give the company a website up front (Place Details returning it is
    // what normally supplies it) so the scrape/Hunter branches, which are
    // gated on merged.website being set, actually get exercised here
    // rather than skipped because nothing populated a website.
    const withWebsite = { ...company, website: "https://example.co.za" };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => null }) as Response));
    vi.mocked(findPublicEmails).mockRejectedValue(new Error("network down"));
    vi.mocked(domainSearch).mockRejectedValue(new Error("hunter down"));
    const provider = new GeoapifyProvider("key", "hunter-key");
    const result = await provider.enrich(withWebsite);
    expect(result).toEqual(withWebsite);
    expect(findPublicEmails).toHaveBeenCalled();
    expect(domainSearch).toHaveBeenCalled();
  });
});
