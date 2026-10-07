import type { ProviderSearchParams } from "../../types";
import { PROVINCE_ISO_CODES } from "@/lib/constants/sa-regions";

// A hard cap on how many elements Overpass returns, kept conservative on
// purpose -- this is a shared, free public resource, not a billed API
// with its own per-account quota.
const RESULT_CAP = 20;

type OsmTag = { key: string; value?: string };

// Honest approximation, same spirit as companydata-provider.ts's
// INDUSTRY_SIC_CODES comment: OSM's tagging vocabulary is consumer/POI
// centric, not built for B2B/industrial classification. Coverage is
// strong for Retail and Construction (craft= tags map cleanly onto
// tradespeople), weak for Manufacturing/Engineering/Facilities
// Management/Transport & Logistics, where OSM rarely has a matching tag
// for the business itself.
export const INDUSTRY_OSM_TAGS: Record<string, OsmTag[]> = {
  Construction: [
    { key: "craft", value: "electrician" },
    { key: "craft", value: "plumber" },
    { key: "craft", value: "carpenter" },
    { key: "craft", value: "roofer" },
    { key: "craft", value: "painter" },
    { key: "craft", value: "builder" },
    { key: "craft", value: "hvac" },
    { key: "shop", value: "trade" },
    { key: "shop", value: "hardware" },
  ],
  Manufacturing: [
    { key: "craft", value: "metal_construction" },
    { key: "shop", value: "building_materials" },
  ],
  Engineering: [
    { key: "office", value: "engineer" },
    { key: "office", value: "company" },
  ],
  "Facilities Management": [
    { key: "office", value: "company" },
    { key: "craft", value: "cleaning" },
    { key: "shop", value: "security" },
  ],
  "Transport & Logistics": [
    { key: "office", value: "logistics" },
    { key: "shop", value: "car_repair" },
  ],
  Retail: [{ key: "shop" }],
  Agriculture: [
    { key: "shop", value: "farm" },
    { key: "craft", value: "agricultural_engines" },
    { key: "landuse", value: "farmyard" },
  ],
};

// Used only when a keyword is given with no industry -- the name regex
// filter below does the real narrowing, so a broader tag sweep is safe
// here (mirrors sa_leads/osm.py's own generic tag set).
const CORE_TAGS: OsmTag[] = [
  { key: "shop" },
  { key: "office" },
  { key: "craft" },
  { key: "amenity", value: "restaurant" },
  { key: "amenity", value: "cafe" },
  { key: "tourism" },
];

function escapeOverpassRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&");
}

export type QueryResult = { ok: true; query: string } | { ok: false; error: string };

/**
 * Builds an Overpass QL query, deliberately NOT mirroring sa_leads/osm.py's
 * unfiltered whole-country sweep -- confirmed against the real public API
 * while planning this feature that whole-country queries time out (504)
 * even for a narrow tag, and that province scope alone isn't safe for a
 * broad tag either. So: province is required (no whole-country fallback),
 * and at least one of industry/keyword is required too, to keep every
 * query narrow enough to actually complete on a shared, free instance.
 */
export function buildQuery(params: ProviderSearchParams): QueryResult {
  const isoCode = params.province ? PROVINCE_ISO_CODES[params.province] : undefined;
  if (!isoCode) {
    return { ok: false, error: "Pick a province to search OpenStreetMap — a nationwide search isn't reliable on the free public service." };
  }
  if (!params.industry && !params.keywords) {
    return { ok: false, error: "Add an industry or a keyword to search OpenStreetMap — too broad a search isn't reliable on the free public service." };
  }

  const tags = params.industry && INDUSTRY_OSM_TAGS[params.industry] ? INDUSTRY_OSM_TAGS[params.industry] : CORE_TAGS;
  const nameFilter = params.keywords ? `["name"~"${escapeOverpassRegex(params.keywords.trim())}",i]` : "";

  const clauses = tags
    .map((tag) => {
      const tagFilter = tag.value ? `["${tag.key}"="${tag.value}"]` : `["${tag.key}"]`;
      return `  nwr["name"]${tagFilter}${nameFilter}(area.za);`;
    })
    .join("\n");

  const query = `[out:json][timeout:30];
area["ISO3166-2"="${isoCode}"]->.za;
(
${clauses}
);
out center tags ${RESULT_CAP};`;

  return { ok: true, query };
}
