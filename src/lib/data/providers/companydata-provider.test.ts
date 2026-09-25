import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildQuery,
  CompanyDataProvider,
  formatRevenue,
  INDUSTRY_SIC_CODES,
  isExportAllowanceError,
  mapRecord,
  mergeCompany,
  normalizeProvince,
  resetExportBlock,
} from "./companydata-provider";

// Shape taken from a real export response (values replaced with fictional ones).
const record = {
  ID: "01043986130",
  "Company Name": "Somerset Trust (PTY) LTD",
  "Trade Name": null,
  "Address 1": "4 Pastorie Park, Reitz St",
  "Address 2": null,
  City: "Cape Town",
  "State/Province": "Western Cape",
  Country: "Southafrica",
  Website: "example-build.co.za",
  "Postal Code": "7130",
  "Company Registration Number": "195003923907",
  "Phone Number": "+27 21 555 0100",
  Email: "Owner@Example-Build.co.za",
  "CEO Name": null,
  "CEO Title": "Director",
  "Yearly Revenue Local Currency": 12343325,
  "Employees On Site": 4,
  "Employees Total": 4,
  Executives: [],
};

describe("buildQuery", () => {
  it("always targets South Africa, contactable companies, on the export endpoint", () => {
    const q = buildQuery({});
    expect(q.get("export")).toBe("true");
    expect(q.get("countryCode")).toBe("ZA");
    expect(q.get("hasEmail")).toBe("true");
    expect(q.get("pageSize")).toBe("10");
  });

  it("omits the export flag for the lightweight search endpoint", () => {
    expect(buildQuery({}, { full: false }).has("export")).toBe(false);
  });

  it("honours a larger page size for paid plans", () => {
    expect(buildQuery({}, { pageSize: 50 }).get("pageSize")).toBe("50");
  });

  it("uppercases province and city, which the API matches exactly", () => {
    const q = buildQuery({ province: "KwaZulu-Natal", city: " Cape Town " });
    expect(q.get("provinceName")).toBe("KWAZULU-NATAL");
    expect(q.get("cityName")).toBe("CAPE TOWN");
  });

  it("maps every Discover industry to SIC codes", () => {
    for (const industry of Object.keys(INDUSTRY_SIC_CODES)) {
      const codes = buildQuery({ industry }).get("sic4Digits")!.split(",");
      expect(codes.length).toBeGreaterThan(0);
      expect(codes.every((c) => /^\d{4}$/.test(c))).toBe(true);
    }
  });

  it("ignores an industry it doesn't know instead of sending a bad filter", () => {
    expect(buildQuery({ industry: "Space Mining" }).has("sic4Digits")).toBe(false);
  });

  it("always sends both ends of an employee range", () => {
    const onlyMin = buildQuery({ employeesMin: 50 });
    expect(onlyMin.get("employeesTotal[min]")).toBe("50");
    expect(onlyMin.get("employeesTotal[max]")).toBe("10000000");
    const onlyMax = buildQuery({ employeesMax: 200 });
    expect(onlyMax.get("employeesTotal[min]")).toBe("0");
    expect(onlyMax.get("employeesTotal[max]")).toBe("200");
    expect(buildQuery({}).has("employeesTotal[min]")).toBe(false);
  });

  it("sends the name filter as `search`", () => {
    expect(buildQuery({ keywords: " Kagiso " }).get("search")).toBe("Kagiso");
  });
});

describe("formatRevenue", () => {
  it.each([
    [null, null],
    [0, null],
    [500_000, "Under R1m"],
    [3_000_000, "R1m - R5m"],
    [12_343_325, "R10m - R50m"],
    [100_000_000, "R50m - R250m"],
    [900_000_000, "R250m+"],
  ])("%s -> %s", (input, expected) => {
    expect(formatRevenue(input)).toBe(expected);
  });
});

describe("mapRecord", () => {
  it("maps a real-shaped record into the app's company shape", () => {
    const c = mapRecord(record, "Construction")!;
    expect(c).toMatchObject({
      externalId: "01043986130",
      source: "CompanyData",
      name: "Somerset Trust (PTY) LTD",
      registrationNumber: "195003923907",
      industry: "Construction",
      province: "Western Cape",
      city: "Cape Town",
      employeeCount: 4,
      revenueRange: "R10m - R50m",
      website: "example-build.co.za",
      phone: "+27 21 555 0100",
      email: "owner@example-build.co.za",
      address: "4 Pastorie Park, Reitz St, Cape Town, 7130",
    });
  });

  it("has no contact when the record names nobody", () => {
    expect(mapRecord(record, null)!.contact).toBeNull();
  });

  it("builds a contact from the CEO name, splitting first and last", () => {
    const c = mapRecord({ ...record, "CEO Name": "Thandi van der Merwe" }, null)!;
    expect(c.contact).toMatchObject({
      firstName: "Thandi",
      lastName: "van der Merwe",
      jobTitle: "Director",
      email: "owner@example-build.co.za",
    });
  });

  it("falls back to the first named executive", () => {
    const c = mapRecord(
      { ...record, Executives: [{}, { "First Name": "Sipho", "Last Name": "Dlamini", Title: "CFO" }] },
      null,
    )!;
    expect(c.contact).toMatchObject({ firstName: "Sipho", lastName: "Dlamini", jobTitle: "CFO" });
  });

  it("skips records with no ID or name, and tolerates missing fields", () => {
    expect(mapRecord({ "Company Name": "No Id" }, null)).toBeNull();
    expect(mapRecord({ ID: "1" }, null)).toBeNull();
    const c = mapRecord({ ID: "1", "Company Name": "Bare Co" }, null)!;
    expect(c).toMatchObject({ email: null, website: null, employeeCount: null, address: null });
  });
});

describe("isExportAllowanceError", () => {
  it("recognises allowance failures but not other 500s or other statuses", () => {
    expect(isExportAllowanceError(500, "E: Error: Export not allowed, over limit")).toBe(true);
    expect(isExportAllowanceError(500, "inactive subscription")).toBe(true);
    expect(isExportAllowanceError(500, "search cluster timeout")).toBe(false);
    expect(isExportAllowanceError(401, "export")).toBe(false);
  });
});

describe("CompanyDataProvider.search", () => {
  beforeEach(() => resetExportBlock());
  afterEach(() => vi.unstubAllGlobals());

  const ok = (records: unknown[]) => ({ ok: true, json: async () => ({ data: { records } }) });
  const fail = (status: number, body: unknown) => ({
    ok: false,
    status,
    statusText: "x",
    json: async () => body,
  });

  it("uses the export endpoint with the key header and maps results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([record, { junk: true }]));
    vi.stubGlobal("fetch", fetchMock);

    const results = await new CompanyDataProvider("test-key").search({ industry: "Engineering" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/app\.companydata\.com\/api\/company\/export\?/);
    expect(init.headers["x-api-key"]).toBe("test-key");
    expect(results).toHaveLength(1);
    expect(results[0].industry).toBe("Engineering");
  });

  it("falls back to basic search when export is refused, and stops retrying that same query", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fail(500, { message: "E: Error: Export not allowed, over limit" }))
      .mockResolvedValue(ok([{ ID: "1", "Company Name": "Basic Co", City: "Durban" }]));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new CompanyDataProvider("k");

    const first = await provider.search({});
    expect(first.map((c) => c.name)).toEqual(["Basic Co"]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/company/export");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/company/search");

    await provider.search({});
    // Export was not attempted again for the same query: it went straight to search.
    expect(String(fetchMock.mock.calls[2][0])).toContain("/api/company/search");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("keeps trying export for a different query after one was refused", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fail(500, { message: "E: Error: Export not allowed, over limit" }))
      .mockResolvedValueOnce(ok([{ ID: "1", "Company Name": "Basic Co" }]))
      .mockResolvedValue(ok([record]));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new CompanyDataProvider("k");

    await provider.search({ province: "Gauteng", industry: "Engineering" });
    const simple = await provider.search({ province: "Gauteng" });

    expect(String(fetchMock.mock.calls[2][0])).toContain("/api/company/export");
    expect(simple[0].email).toBe("owner@example-build.co.za");
  });

  it.each([
    [401, /rejected the API key/],
    [403, /rejected the API key/],
    [429, /quota or rate limit/],
    [500, /search failed: 500/],
  ])("turns HTTP %s into a clear error", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fail(status, { error: "cluster down" })));
    await expect(new CompanyDataProvider("k").search({})).rejects.toThrow(message);
  });
});

describe("mergeCompany", () => {
  const base = mapRecord({ ID: "1", "Company Name": "Basic Co", City: "Durban" }, "Engineering")!;

  it("fills gaps from the full record without overwriting known values", () => {
    const full = mapRecord({ ...record, ID: "1", "Company Name": "Basic Co Ltd", City: "" }, null)!;
    const merged = mergeCompany(base, full);
    expect(merged.email).toBe("owner@example-build.co.za");
    expect(merged.employeeCount).toBe(4);
    // The full record's city was blank, so the known value is kept.
    expect(merged.city).toBe("Durban");
    expect(merged.industry).toBe("Engineering");
  });

  it("never replaces a real value with a blank", () => {
    const withEmail = { ...base, email: "keep@x.co.za" };
    const blank = mapRecord({ ID: "1", "Company Name": "Basic Co" }, null)!;
    expect(mergeCompany(withEmail, blank).email).toBe("keep@x.co.za");
  });
});

describe("CompanyDataProvider.enrich", () => {
  afterEach(() => vi.unstubAllGlobals());
  const base = mapRecord({ ID: "01043986130", "Company Name": "Somerset Trust (PTY) LTD" }, "Construction")!;

  it("looks the company up by ID and merges the full record", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { records: [record] } }) });
    vi.stubGlobal("fetch", fetchMock);

    const full = await new CompanyDataProvider("k").enrich(base);

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/api/company/export");
    expect(url.searchParams.get("ID")).toBe("01043986130");
    expect(url.searchParams.get("pageSize")).toBe("1");
    expect(full?.email).toBe("owner@example-build.co.za");
    expect(full?.industry).toBe("Construction");
  });

  it("returns null instead of throwing when refused, unreachable, or empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "x", json: async () => ({ message: "over limit" }) }));
    expect(await new CompanyDataProvider("k").enrich(base)).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await new CompanyDataProvider("k").enrich(base)).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { records: [] } }) }));
    expect(await new CompanyDataProvider("k").enrich(base)).toBeNull();
  });
});

describe("normalizeProvince", () => {
  it.each([
    ["Kwazulu-natal", "KwaZulu-Natal"],
    ["KWAZULU-NATAL", "KwaZulu-Natal"],
    ["north west", "North West"],
    ["Gauteng", "Gauteng"],
    ["Western Cape", "Western Cape"],
    ["Somewhere Else", "Somewhere Else"],
    [null, null],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeProvince(input)).toBe(expected);
  });

  it("is applied when mapping records", () => {
    expect(mapRecord({ ID: "1", "Company Name": "X", "State/Province": "Kwazulu-natal" }, null)!.province).toBe(
      "KwaZulu-Natal",
    );
  });
});
