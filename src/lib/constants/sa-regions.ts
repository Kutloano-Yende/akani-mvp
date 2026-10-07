/**
 * Single source of truth for South Africa's industry/province option lists
 * -- previously copy-pasted independently in discover-form.tsx,
 * add-prospect-form.tsx, and companydata-provider.ts, with nothing keeping
 * them in sync. The OSM provider needs a fourth copy plus a province ->
 * ISO3166-2 table that didn't exist anywhere, which is what forced this
 * consolidation rather than adding yet another copy.
 */
export const INDUSTRIES = [
  "Construction",
  "Manufacturing",
  "Engineering",
  "Facilities Management",
  "Transport & Logistics",
  "Retail",
  "Agriculture",
] as const;

export const PROVINCES = [
  "Gauteng",
  "Western Cape",
  "KwaZulu-Natal",
  "Eastern Cape",
  "Free State",
  "Mpumalanga",
  "North West",
  "Limpopo",
  "Northern Cape",
] as const;

// Used to scope an Overpass query to a province via area["ISO3166-2"="..."]
// -- confirmed working against the real public API (whole-country queries
// timed out; province-level ones didn't).
export const PROVINCE_ISO_CODES: Record<string, string> = {
  Gauteng: "ZA-GT",
  "Western Cape": "ZA-WC",
  "KwaZulu-Natal": "ZA-KZN",
  "Eastern Cape": "ZA-EC",
  "Free State": "ZA-FS",
  Mpumalanga: "ZA-MP",
  "North West": "ZA-NW",
  Limpopo: "ZA-LP",
  "Northern Cape": "ZA-NC",
};
