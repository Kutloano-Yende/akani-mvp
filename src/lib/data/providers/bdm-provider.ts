import type { DataProvider, ProviderCompany, ProviderSearchParams } from "../types";

/**
 * Real BDM DataFinder integration. Credentials are server-side only
 * (BDM_DATAFINDER_API_KEY / BDM_DATAFINDER_BASE_URL in .env.local) — this
 * class is only ever imported from server code (API routes), never from a
 * client component, so the key is never bundled to the browser.
 *
 * The request/response shape below is a best guess pending BDM's actual API
 * docs — confirm field names and auth scheme against their reference before
 * relying on this in production, and adjust `mapCompany` accordingly.
 */
export class BDMDataFinderProvider implements DataProvider {
  readonly name = "BDM DataFinder";

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
  ) {}

  async search(params: ProviderSearchParams): Promise<ProviderCompany[]> {
    const url = new URL("/v1/companies/search", this.baseUrl);
    if (params.industry) url.searchParams.set("industry", params.industry);
    if (params.province) url.searchParams.set("province", params.province);
    if (params.city) url.searchParams.set("city", params.city);
    if (params.keywords) url.searchParams.set("q", params.keywords);
    if (params.employeesMin !== undefined)
      url.searchParams.set("employees_min", String(params.employeesMin));
    if (params.employeesMax !== undefined)
      url.searchParams.set("employees_max", String(params.employeesMax));

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`BDM DataFinder search failed: ${res.status} ${res.statusText}`);
    }

    const body = await res.json();
    const results: unknown[] = Array.isArray(body?.results) ? body.results : [];
    return results.map(mapCompany);
  }
}

function mapCompany(raw: unknown): ProviderCompany {
  const r = raw as Record<string, unknown>;
  const contact = r.primary_contact as Record<string, unknown> | undefined;

  return {
    externalId: String(r.id ?? ""),
    source: "BDM DataFinder",
    name: String(r.company_name ?? ""),
    registrationNumber: (r.registration_number as string) ?? null,
    industry: (r.industry as string) ?? null,
    province: (r.province as string) ?? null,
    city: (r.city as string) ?? null,
    employeeCount: typeof r.employee_count === "number" ? r.employee_count : null,
    revenueRange: (r.revenue_range as string) ?? null,
    website: (r.website as string) ?? null,
    phone: (r.phone as string) ?? null,
    email: (r.email as string) ?? null,
    address: (r.address as string) ?? null,
    contact: contact
      ? {
          firstName: String(contact.first_name ?? ""),
          lastName: String(contact.last_name ?? ""),
          jobTitle: String(contact.job_title ?? ""),
          email: String(contact.email ?? ""),
          phone: String(contact.phone ?? ""),
        }
      : null,
  };
}
