import type { ProviderCompany, ProviderSearchParams } from "../../types";
import { PROVINCE_BBOX } from "@/lib/constants/sa-regions";

const SOURCE = "Geoapify";
const RESULT_LIMIT = 20;

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

// Honest approximation, same spirit as CompanyData's INDUSTRY_SIC_CODES and
// OpenStreetMap's INDUSTRY_OSM_TAGS: Geoapify's taxonomy has no exact
// top-level category for Construction/Manufacturing/Engineering/Transport
// & Logistics -- these are the closest available child keys. Coverage will
// vary by industry, same as every other provider's category/tag mapping.
export const INDUSTRY_GEOAPIFY_CATEGORIES: Record<string, string[]> = {
  Construction: [
    "commercial.houseware_and_hardware.building_materials",
    "commercial.houseware_and_hardware.hardware_and_tools",
    "service.carpenter",
    "service.electrician",
    "service.metal_construction",
    "service.blacksmith",
    "office.architect",
  ],
  Manufacturing: ["production.factory", "building.industrial"],
  Engineering: ["office.architect", "office.consulting", "office.research", "office.it", "office.company"],
  "Facilities Management": ["service.cleaning", "office.security", "service.recycling.centre"],
  "Transport & Logistics": ["office.logistics", "service.vehicle", "commercial.vehicle", "service.post"],
  Retail: [
    "commercial",
    "commercial.supermarket",
    "commercial.convenience",
    "commercial.department_store",
    "commercial.discount_store",
    "commercial.shopping_mall",
    "commercial.marketplace",
  ],
  Agriculture: [
    "commercial.agrarian",
    "commercial.food_and_drink.farm",
    "commercial.garden",
    "office.forestry",
    "office.government.agriculture",
  ],
};

export type QueryResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Builds the Geoapify Places request URL. Unlike the OpenStreetMap
 * provider (province required, industry OR keyword required), both
 * province AND industry are required here -- Geoapify's own `categories`
 * param is mandatory, there's no either/or. Checked before any network
 * call so a bad request never reaches the API.
 */
export function buildPlacesUrl(params: ProviderSearchParams, apiKey: string): QueryResult {
  const bbox = params.province ? PROVINCE_BBOX[params.province] : undefined;
  if (!bbox) {
    return { ok: false, error: "Pick a province to search Geoapify — a nationwide search isn't reliable, and Geoapify's bounding-box filter needs one." };
  }
  const categories = params.industry ? INDUSTRY_GEOAPIFY_CATEGORIES[params.industry] : undefined;
  if (!categories || categories.length === 0) {
    return { ok: false, error: "Pick an industry to search Geoapify — its categories parameter is required by the API." };
  }

  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("categories", categories.join(","));
  url.searchParams.set("filter", `rect:${bbox.join(",")}`);
  if (params.keywords) url.searchParams.set("name", params.keywords.trim());
  url.searchParams.set("limit", String(RESULT_LIMIT));

  return { ok: true, url: url.toString() };
}

type GeoapifyFeature = {
  properties?: {
    place_id?: string;
    name?: string;
    state?: string;
    city?: string;
    formatted?: string;
    address_line1?: string;
  };
};

/**
 * Maps a Geoapify Places response straight to ProviderCompany. Website,
 * phone, and email are always null here -- confirmed from Geoapify's own
 * docs that the Places search endpoint never returns contact fields, only
 * Place Details does (see place-details.ts, called only at import time).
 */
export function parsePlaces(payload: unknown, searchedIndustry: string, searchedProvince: string): ProviderCompany[] {
  const body = payload as { features?: GeoapifyFeature[] } | null;
  const features = Array.isArray(body?.features) ? body.features : [];
  const companies: ProviderCompany[] = [];

  for (const feature of features) {
    const props = feature.properties ?? {};
    const name = str(props.name);
    const placeId = str(props.place_id);
    if (!name || !placeId) continue;

    companies.push({
      externalId: placeId,
      source: SOURCE,
      name,
      registrationNumber: null,
      // Geoapify's `categories` array holds internal taxonomy keys, not a
      // human label -- label with the industry that was searched instead,
      // the same convention CompanyData already uses for its SIC-code search.
      industry: searchedIndustry,
      // Prefer Geoapify's own returned province when present (unlike
      // industry, it usually does return a readable name); fall back to
      // what was searched only when absent.
      province: str(props.state) ?? searchedProvince,
      city: str(props.city),
      employeeCount: null,
      revenueRange: null,
      website: null,
      phone: null,
      email: null,
      address: str(props.formatted) ?? str(props.address_line1),
      contact: null,
    });
  }

  return companies;
}
