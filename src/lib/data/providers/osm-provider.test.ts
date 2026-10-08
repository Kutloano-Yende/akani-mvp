import { describe, expect, it, vi, afterEach } from "vitest";
import { OsmProvider, OsmValidationError } from "./osm-provider";

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
  externalId: "way/1",
  source: "OpenStreetMap",
  name: "Example Co",
  registrationNumber: null,
  industry: "electrician",
  province: "Gauteng",
  city: "Johannesburg",
  employeeCount: null,
  revenueRange: null,
  website: "https://example.co.za",
  phone: null,
  email: null,
  address: null,
  contact: null,
};

describe("OsmProvider.search", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects without calling the network when the query is invalid (no province)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OsmProvider();
    await expect(provider.search({ industry: "Retail" })).rejects.toThrow(OsmValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects without a province or keyword", async () => {
    const provider = new OsmProvider();
    await expect(provider.search({ province: "Gauteng" })).rejects.toThrow(OsmValidationError);
  });

  it("returns parsed companies for a valid, scoped search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          elements: [{ type: "way", id: 1, tags: { name: "Example Co", craft: "electrician", "addr:city": "Johannesburg" } }],
        }),
      }) as Response),
    );
    const provider = new OsmProvider();
    const results = await provider.search({ province: "Gauteng", industry: "Construction" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Example Co");
  });

  it("filters results by city after parsing, not before", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          elements: [
            { type: "way", id: 1, tags: { name: "In Joburg", "addr:city": "Johannesburg" } },
            { type: "way", id: 2, tags: { name: "In Pretoria", "addr:city": "Pretoria" } },
          ],
        }),
      }) as Response),
    );
    const provider = new OsmProvider();
    const results = await provider.search({ province: "Gauteng", city: "johannesburg", industry: "Retail" });
    expect(results.map((r) => r.name)).toEqual(["In Joburg"]);
  });

  it("maps a 504/busy response to a friendly message after exhausting the retry", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 504,
      text: async () => `<strong style="color:#FF0000">Error</strong>: runtime error: timeout. The server is probably too busy to handle your request.`,
    }) as Response);
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OsmProvider();
    await expect(provider.search({ province: "Gauteng", industry: "Retail" })).rejects.toThrow(/busy/i);
    // One attempt, one retry -- not more, not fewer.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("succeeds on the retry when the first attempt fails transiently", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) return { ok: false, status: 504, text: async () => "busy" } as Response;
        return {
          ok: true,
          json: async () => ({ elements: [{ type: "way", id: 1, tags: { name: "Recovered Co", shop: "trade" } }] }),
        } as Response;
      }),
    );
    const provider = new OsmProvider();
    const results = await provider.search({ province: "Gauteng", industry: "Retail" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Recovered Co");
    expect(calls).toBe(2);
  });

  it("handles a malformed (non-JSON) success response without crashing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new Error("not json");
        },
      }) as unknown as Response),
    );
    const provider = new OsmProvider();
    await expect(provider.search({ province: "Gauteng", industry: "Retail" })).rejects.toThrow();
  });
});

describe("OsmProvider.enrich", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns the company unchanged when there's no website", async () => {
    const provider = new OsmProvider();
    const result = await provider.enrich({ ...company, website: null });
    expect(result).toEqual({ ...company, website: null });
    expect(findPublicEmails).not.toHaveBeenCalled();
  });

  it("uses a generic-classified website-scraped email and never calls Hunter", async () => {
    vi.mocked(findPublicEmails).mockResolvedValue([
      { email: "person@example.co.za", pageUrl: "x", type: "other_public" },
      { email: "info@example.co.za", pageUrl: "x", type: "generic" },
    ]);
    const provider = new OsmProvider(undefined, "hunter-key");
    const result = await provider.enrich(company);
    expect(result?.email).toBe("info@example.co.za");
    expect(domainSearch).not.toHaveBeenCalled();
  });

  it("falls back to Hunter only when the scrape finds nothing and a key is configured", async () => {
    vi.mocked(findPublicEmails).mockResolvedValue([]);
    vi.mocked(domainSearch).mockResolvedValue([{ value: "info@example.co.za", type: "generic" }]);
    vi.mocked(verifyEmail).mockResolvedValue({ status: "valid" });

    const provider = new OsmProvider(undefined, "hunter-key");
    const result = await provider.enrich(company);
    expect(result?.email).toBe("info@example.co.za");
    expect(domainSearch).toHaveBeenCalledWith("hunter-key", "example.co.za");
  });

  it("works correctly with Hunter entirely unconfigured — stays optional", async () => {
    vi.mocked(findPublicEmails).mockResolvedValue([]);
    const provider = new OsmProvider(undefined, undefined);
    const result = await provider.enrich(company);
    expect(result?.email).toBeNull();
    expect(domainSearch).not.toHaveBeenCalled();
  });

  it("discards a Hunter email that fails verification", async () => {
    vi.mocked(findPublicEmails).mockResolvedValue([]);
    vi.mocked(domainSearch).mockResolvedValue([{ value: "info@example.co.za", type: "generic" }]);
    vi.mocked(verifyEmail).mockResolvedValue({ status: "invalid" });

    const provider = new OsmProvider(undefined, "hunter-key");
    const result = await provider.enrich(company);
    expect(result?.email).toBeNull();
  });

  it("never throws out of enrich when the scrape errors", async () => {
    vi.mocked(findPublicEmails).mockRejectedValue(new Error("network down"));
    const provider = new OsmProvider(undefined, undefined);
    await expect(provider.enrich(company)).resolves.not.toThrow();
  });

  it("never throws out of enrich when Hunter errors", async () => {
    vi.mocked(findPublicEmails).mockResolvedValue([]);
    vi.mocked(domainSearch).mockRejectedValue(new Error("hunter down"));
    const provider = new OsmProvider(undefined, "hunter-key");
    const result = await provider.enrich(company);
    expect(result?.email).toBeNull();
  });
});
