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

// Used to scope a Geoapify Places search to a province via
// filter=rect:minLon,minLat,maxLon,maxLat (Geoapify's `rect` filter is
// axis-aligned, not a province polygon, so these are deliberately padded
// mainland rectangles, not exact borders -- a result just across a
// provincial boundary can occasionally appear, same approximation
// CompanyData already makes elsewhere). Hand-curated, not taken raw from a
// geocoder: a real check against Nominatim while building this surfaced
// that its raw Western Cape bounding box is contaminated by the Prince
// Edward Islands (a sub-Antarctic territory administratively part of
// Western Cape but nowhere near the mainland), which would have produced
// an unusably huge search area.
export const PROVINCE_BBOX: Record<string, [minLon: number, minLat: number, maxLon: number, maxLat: number]> = {
  Gauteng: [27.0, -27.0, 29.2, -25.0],
  "Western Cape": [17.5, -34.9, 25.2, -30.4],
  "KwaZulu-Natal": [28.8, -31.3, 33.1, -26.7],
  "Eastern Cape": [22.2, -34.3, 30.5, -29.9],
  "Free State": [24.2, -30.8, 29.9, -26.5],
  Mpumalanga: [28.0, -27.3, 32.1, -24.5],
  "North West": [22.5, -28.0, 27.9, -24.3],
  Limpopo: [26.3, -25.5, 32.0, -22.0],
  "Northern Cape": [16.3, -33.0, 25.5, -26.6],
};
