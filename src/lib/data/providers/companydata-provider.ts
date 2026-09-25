import type { DataProvider, ProviderCompany, ProviderSearchParams } from "../types";

const SOURCE = "CompanyData";
const DEFAULT_BASE_URL = "https://app.companydata.com";
// A trial key refuses export requests larger than 10 records ("over limit");
// paid plans allow far more. Override with COMPANYDATA_PAGE_SIZE.
const DEFAULT_PAGE_SIZE = 10;
const EXPORT_RETRY_AFTER_MS = 10 * 60_000;

// The API doesn't return an industry field, but it can filter by SIC code, so
// each Discover industry is searched as a curated set of common SIC codes and
// results are labelled with the industry that was searched. This is an
// approximation: a company outside these codes won't appear under that industry.
export const INDUSTRY_SIC_CODES: Record<string, string[]> = {
  Construction: [
    "1521", "1522", "1531", "1541", "1542", "1611", "1622", "1623", "1629", "1711", "1721",
    "1731", "1741", "1742", "1743", "1751", "1752", "1761", "1771", "1781", "1791", "1793",
    "1794", "1795", "1796", "1799",
  ],
  Manufacturing: [
    "3312", "3315", "3441", "3442", "3443", "3444", "3446", "3448", "3449", "3451", "3452",
    "3462", "3469", "3471", "3479", "3499", "3523", "3531", "3532", "3537", "3559", "3569",
    "3599", "3081", "3082", "3083", "3084", "3085", "3086", "3089", "2421", "2431", "2434",
    "2653", "2657",
  ],
  Engineering: ["8711", "8712", "8713", "8734", "8748"],
  "Facilities Management": ["7349", "7342", "7381", "7382", "7217", "0782", "8744"],
  "Transport & Logistics": [
    "4212", "4213", "4214", "4215", "4222", "4225", "4226", "4231", "4491", "4731", "4789",
    "4111", "4119", "4142", "4151",
  ],
  Retail: [
    "5211", "5231", "5251", "5311", "5331", "5399", "5411", "5412", "5499", "5511", "5531",
    "5651", "5661", "5712", "5731", "5734", "5912", "5941", "5945", "5961", "5999",
  ],
  Agriculture: [
    "0111", "0115", "0116", "0119", "0131", "0161", "0171", "0172", "0173", "0175", "0179",
    "0181", "0191", "0211", "0212", "0213", "0214", "0219", "0241", "0251", "0252", "0259",
    "0291", "0711", "0721", "0723", "0751", "0762",
  ],
};

// Exported for tests. The export endpoint is used (not search) because search
// returns only name/address, while export includes email, phone, website,
// registration number, employees and revenue.
export function buildQuery(
  params: ProviderSearchParams,
  opts: { full?: boolean; pageSize?: number } = {},
): URLSearchParams {
  const { full = true, pageSize = DEFAULT_PAGE_SIZE } = opts;
  const q = new URLSearchParams();
  if (full) q.set("export", "true");
  q.set("countryCode", "ZA");
  // Campaigns are email-based, so only surface companies we can actually contact.
  q.set("hasEmail", "true");
  q.set("page", "1");
  q.set("pageSize", String(pageSize));

  const sic = params.industry ? INDUSTRY_SIC_CODES[params.industry] : undefined;
  if (sic) q.set("sic4Digits", sic.join(","));

  // Province and city are stored in UPPERCASE and matched exactly.
  if (params.province) q.set("provinceName", params.province.trim().toUpperCase());
  if (params.city) q.set("cityName", params.city.trim().toUpperCase());
  // Name lookup matches from the start of the stored name.
  if (params.keywords) q.set("search", params.keywords.trim());

  // The API wants both ends of a range together.
  if (params.employeesMin !== undefined || params.employeesMax !== undefined) {
    q.set("employeesTotal[min]", String(params.employeesMin ?? 0));
    q.set("employeesTotal[max]", String(params.employeesMax ?? 10_000_000));
  }

  return q;
}

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Buckets in rand, in the same style as the rest of the app ("R10m - R50m").
export function formatRevenue(zar: number | null): string | null {
  if (zar === null || zar <= 0) return null;
  const m = zar / 1_000_000;
  if (m < 1) return "Under R1m";
  if (m < 5) return "R1m - R5m";
  if (m < 10) return "R5m - R10m";
  if (m < 50) return "R10m - R50m";
  if (m < 250) return "R50m - R250m";
  return "R250m+";
}

const PROVINCES = [
  "Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape", "Free State",
  "Mpumalanga", "North West", "Limpopo", "Northern Cape",
];
const PROVINCE_BY_KEY = new Map(PROVINCES.map((p) => [p.toLowerCase().replace(/[^a-z]/g, ""), p]));

// The API spells provinces its own way ("Kwazulu-natal"); use the same names as
// the Discover dropdown so provinces group and filter consistently.
export function normalizeProvince(raw: string | null): string | null {
  if (!raw) return null;
  return PROVINCE_BY_KEY.get(raw.toLowerCase().replace(/[^a-z]/g, "")) ?? raw;
}

function pickContact(r: Record<string, unknown>, email: string | null, phone: string | null) {
  let first: string | null = null;
  let last: string | null = null;
  let title = str(r["CEO Title"]);

  const ceo = str(r["CEO Name"]);
  if (ceo) {
    const parts = ceo.split(/\s+/);
    first = parts[0];
    last = parts.slice(1).join(" ") || null;
  } else if (Array.isArray(r["Executives"])) {
    const exec = (r["Executives"] as Record<string, unknown>[]).find(
      (e) => str(e["First Name"]) || str(e["Last Name"]),
    );
    if (exec) {
      first = str(exec["First Name"]);
      last = str(exec["Last Name"]);
      title = str(exec["Title"]) ?? str(exec["Position"]) ?? title;
    }
  }

  // Without a named person there's no contact — the company address still works.
  if (!first && !last) return null;
  return {
    firstName: first ?? "",
    lastName: last ?? "",
    jobTitle: title ?? "",
    email: email ?? "",
    phone: phone ?? "",
  };
}

// Exported for tests. `industry` is the industry that was searched, since the
// API doesn't return one.
export function mapRecord(raw: unknown, industry: string | null): ProviderCompany | null {
  const r = raw as Record<string, unknown>;
  const externalId = str(r["ID"]) ?? str(r["UniqueID"]);
  const name = str(r["Company Name"]);
  if (!externalId || !name) return null;

  const email = str(r["Email"])?.toLowerCase() ?? null;
  const phone = str(r["Phone Number"]);
  const city = str(r["City"]);

  return {
    externalId,
    source: SOURCE,
    name,
    registrationNumber: str(r["Company Registration Number"]),
    industry,
    province: normalizeProvince(str(r["State/Province"])),
    city,
    employeeCount: num(r["Employees Total"]) ?? num(r["Employees On Site"]),
    revenueRange: formatRevenue(num(r["Yearly Revenue Local Currency"])),
    website: str(r["Website"]),
    phone,
    email,
    address:
      [str(r["Address 1"]), str(r["Address 2"]), city, str(r["Postal Code"])]
        .filter(Boolean)
        .join(", ") || null,
    contact: pickContact(r, email, phone),
  };
}

// Export is refused for some queries on restricted plans (a trial rejects
// combined filters and large pages) but not others. Remember refusals per
// query for a while, so the same doomed request isn't repeated on every search
// while simpler searches keep getting full records.
const exportRefusedUntil = new Map<string, number>();

export function isExportAllowanceError(status: number, detail: string): boolean {
  return status === 500 && /export|allowance|over limit|subscription/i.test(detail);
}

export class CompanyDataProvider implements DataProvider {
  readonly name = SOURCE;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
    private readonly pageSize: number = DEFAULT_PAGE_SIZE,
  ) {}

  async search(params: ProviderSearchParams): Promise<ProviderCompany[]> {
    const industry = params.industry && INDUSTRY_SIC_CODES[params.industry] ? params.industry : null;
    let body: { data?: { records?: unknown[] } } | null = null;

    // Full records (email, phone, website, employees, revenue) come from the
    // export endpoint; if the account can't export, fall back to the lightweight
    // search endpoint, which still returns company, address and province.
    const queryKey = buildQuery(params, { full: false, pageSize: this.pageSize }).toString();
    if (Date.now() >= (exportRefusedUntil.get(queryKey) ?? 0)) {
      const res = await this.call("/api/company/export", params, true);
      if (res.ok) {
        body = await res.json();
      } else {
        const detail = await this.errorDetail(res);
        if (!isExportAllowanceError(res.status, detail)) this.fail(res.status, detail);
        exportRefusedUntil.set(queryKey, Date.now() + EXPORT_RETRY_AFTER_MS);
        console.warn(`CompanyData export refused for this query (${detail}); using basic search`);
      }
    }

    if (!body) {
      const res = await this.call("/api/company/search", params, false);
      if (!res.ok) this.fail(res.status, await this.errorDetail(res));
      body = await res.json();
    }

    const records: unknown[] = Array.isArray(body?.data?.records) ? body.data.records : [];
    return records.map((r) => mapRecord(r, industry)).filter((c): c is ProviderCompany => c !== null);
  }

  // Single-company lookups by ID are served even where broader exports are
  // refused, so this is how basic search results get their contact details.
  async enrich(company: ProviderCompany): Promise<ProviderCompany | null> {
    try {
      const url = new URL("/api/company/export", this.baseUrl);
      url.search = new URLSearchParams({
        export: "true",
        ID: company.externalId,
        pageSize: "1",
      }).toString();

      const res = await fetch(url, {
        headers: { "x-api-key": this.apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        console.warn(`CompanyData enrich refused (${res.status}): ${await this.errorDetail(res)}`);
        return null;
      }

      const body = await res.json();
      const record = Array.isArray(body?.data?.records) ? body.data.records[0] : null;
      const full = record ? mapRecord(record, company.industry) : null;
      return full ? mergeCompany(company, full) : null;
    } catch (err) {
      console.warn("CompanyData enrich failed", err);
      return null;
    }
  }

  private call(path: string, params: ProviderSearchParams, full: boolean) {
    const url = new URL(path, this.baseUrl);
    url.search = buildQuery(params, { full, pageSize: this.pageSize }).toString();
    return fetch(url, {
      headers: { "x-api-key": this.apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
  }

  private async errorDetail(res: Response): Promise<string> {
    const body = await res.json().catch(() => null);
    return String(body?.error ?? body?.message ?? res.statusText);
  }

  private fail(status: number, detail: string): never {
    if (status === 401 || status === 403) {
      throw new Error(`CompanyData rejected the API key (${status}): ${detail}`);
    }
    if (status === 429) {
      throw new Error(`CompanyData quota or rate limit reached: ${detail}`);
    }
    throw new Error(`CompanyData search failed: ${status} ${detail}`);
  }
}

// Fill gaps in `base` with anything `full` knows, never overwriting real data
// with a blank.
export function mergeCompany(base: ProviderCompany, full: ProviderCompany): ProviderCompany {
  const merged = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(full)) {
    if (value !== null && value !== undefined && value !== "") merged[key] = value;
  }
  merged.industry = base.industry ?? full.industry;
  return merged as ProviderCompany;
}

// Test hook: forget any remembered export refusals.
export function resetExportBlock() {
  exportRefusedUntil.clear();
}
