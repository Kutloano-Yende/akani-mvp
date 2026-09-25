export type ProviderSearchParams = {
  industry?: string;
  province?: string;
  employeesMin?: number;
  employeesMax?: number;
  keywords?: string;
  city?: string;
};

export type ProviderCompany = {
  externalId: string;
  source: string;
  name: string;
  registrationNumber: string | null;
  industry: string | null;
  province: string | null;
  city: string | null;
  employeeCount: number | null;
  revenueRange: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  contact: {
    firstName: string;
    lastName: string;
    jobTitle: string;
    email: string;
    phone: string;
  } | null;
};

/**
 * A business-data source Discover Businesses can search. Implementations
 * live behind this so the Discover screen and /api/data-provider/search
 * never need to change when we switch from the mock catalogue to a real
 * provider, or add a second one later.
 */
export interface DataProvider {
  readonly name: string;
  search(params: ProviderSearchParams): Promise<ProviderCompany[]>;
  /**
   * Optional: fetch the full record for one company found by `search`, for
   * providers whose search results carry only basic details. Returns null if
   * unavailable; must never throw.
   */
  enrich?(company: ProviderCompany): Promise<ProviderCompany | null>;
}
