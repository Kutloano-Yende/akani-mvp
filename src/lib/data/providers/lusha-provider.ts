import type { DataProvider, ProviderCompany, ProviderSearchParams } from "../types";
import { normalizeProvince, mergeCompany } from "./companydata-provider";

const SOURCE = "Lusha";
const BASE_URL = "https://api.lusha.com";
// Lusha's Prospecting Companies endpoint bills per result returned, unlike
// CompanyData's search step — keep this modest. Override with LUSHA_PAGE_SIZE.
const DEFAULT_PAGE_SIZE = 10;

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Confirmed against a real production enrich response, 2026-10-07: despite
// the docs' prose implying a flat "phone"/"email", the actual company
// object carries plural arrays -- phones: [{ number }], emails: [{ email }]
// -- so reading r.phone/r.email (singular) silently returned undefined for
// every company. Takes the first entry; Lusha doesn't document a sort order
// for "best" contact, so first is as good a default as any.
const firstArrayField = (arr: unknown, key: string): string | null => {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const first = arr[0] as Record<string, unknown> | undefined;
  return str(first?.[key] ?? null);
};

// Verified against Lusha's V3 API docs (docs.lusha.com/apis/openapi/prospecting)
// and its mock server, 2026-09-28.
export function buildFilters(params: ProviderSearchParams) {
  const location: Record<string, string> = { country: "South Africa" };
  if (params.province) location.state = params.province;
  if (params.city) location.city = params.city;

  const include: Record<string, unknown> = { locations: [location] };
  if (params.employeesMin !== undefined || params.employeesMax !== undefined) {
    include.sizes = [{ min: params.employeesMin ?? 1, max: params.employeesMax ?? 1_000_000 }];
  }
  // Lusha's precise industry filter (mainIndustriesIds) takes numeric ids that
  // would need a separate lookup call (GET .../prospecting/filters/industriesLabels)
  // to map our industry names to. Passed as a keyword instead — an
  // approximation, good enough for Discover, cheap to change later if a
  // maintained id mapping is worth adding.
  const keywords = [params.industry, params.keywords].filter((v): v is string => !!v?.trim());
  if (keywords.length > 0) include.keywords = keywords;

  return { companies: { include } };
}

// Maps a V3CompanyPreview (Prospecting Companies result) — no phone/email/
// address here, only what enrich() can add.
export function mapPreview(raw: unknown): ProviderCompany | null {
  const r = raw as Record<string, unknown>;
  const externalId = str(r.id);
  const name = str(r.name);
  if (!externalId || !name) return null;

  const employeeCount = r.employeeCount as Record<string, unknown> | undefined;
  const location = r.location as Record<string, unknown> | undefined;

  return {
    externalId,
    source: SOURCE,
    name,
    registrationNumber: null,
    industry: str(r.industry),
    province: normalizeProvince(str(location?.state ?? null)),
    city: str(location?.city ?? null),
    employeeCount: num(employeeCount?.exact) ?? num(employeeCount?.max) ?? num(employeeCount?.min),
    revenueRange: null,
    website: str(r.domain),
    phone: null,
    email: null,
    address: null,
    contact: null,
  };
}

// Maps a V3EnrichedCompany (Enrich Companies result). phone/email come from
// the base (non-premium) response — confirmed against a real production
// response, not assumed. Location isn't repeated here, so mergeCompany
// keeps the province/city already known from the search step.
export function mapEnriched(raw: unknown): ProviderCompany | null {
  const r = raw as Record<string, unknown>;
  const externalId = str(r.id);
  const name = str(r.name);
  if (!externalId || !name) return null;

  const employeeCount = r.employeeCount as Record<string, unknown> | undefined;

  return {
    externalId,
    source: SOURCE,
    name,
    registrationNumber: null,
    industry: str(r.industry),
    province: null,
    city: null,
    employeeCount: num(employeeCount?.exact) ?? num(employeeCount?.max) ?? num(employeeCount?.min),
    revenueRange: null,
    website: str(r.domain),
    phone: firstArrayField(r.phones, "number"),
    email: firstArrayField(r.emails, "email"),
    address: null,
    // Company-level enrich doesn't return a named person; Lusha has a
    // separate Contacts API for that, not wired up here.
    contact: null,
  };
}

export class LushaProvider implements DataProvider {
  readonly name = SOURCE;

  constructor(
    private readonly apiKey: string,
    private readonly pageSize: number = DEFAULT_PAGE_SIZE,
  ) {}

  async search(params: ProviderSearchParams): Promise<ProviderCompany[]> {
    const res = await this.call("/v3/companies/prospecting", {
      pagination: { page: 0, size: this.pageSize },
      filters: buildFilters(params),
    });
    if (!res.ok) this.fail(res.status, await this.errorDetail(res));

    const body = await res.json();
    const results: unknown[] = Array.isArray(body?.results) ? body.results : [];
    return results.map(mapPreview).filter((c): c is ProviderCompany => c !== null);
  }

  // Only called for a company actually being imported — enrich is billed per
  // revealed result, so it's never run across a whole page of search results.
  async enrich(company: ProviderCompany): Promise<ProviderCompany | null> {
    try {
      const res = await this.call("/v3/companies/enrich", { ids: [company.externalId] });
      if (!res.ok) {
        console.warn(`Lusha enrich refused (${res.status}): ${await this.errorDetail(res)}`);
        return null;
      }
      const body = await res.json();
      const record = Array.isArray(body?.results) ? body.results[0] : null;
      const full = record ? mapEnriched(record) : null;
      return full ? mergeCompany(company, full) : null;
    } catch (err) {
      console.warn("Lusha enrich failed", err);
      return null;
    }
  }

  private call(path: string, body: unknown) {
    return fetch(new URL(path, BASE_URL), {
      method: "POST",
      headers: { api_key: this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  }

  private async errorDetail(res: Response): Promise<string> {
    const body = await res.json().catch(() => null);
    return String(body?.message ?? res.statusText);
  }

  private fail(status: number, detail: string): never {
    if (status === 401) throw new Error(`Lusha rejected the API key: ${detail}`);
    if (status === 402) throw new Error(`Lusha: insufficient credits: ${detail}`);
    if (status === 429) throw new Error(`Lusha rate limit reached: ${detail}`);
    throw new Error(`Lusha search failed: ${status} ${detail}`);
  }
}
