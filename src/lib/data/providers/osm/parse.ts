import type { ProviderCompany } from "../../types";

const SOURCE = "OpenStreetMap";

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

// Picks the first non-empty tag value among several possible keys --
// Overpass tags aren't consistently named across elements (e.g. some use
// "contact:email", others just "email").
function first(tags: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = str(tags[key]);
    if (value) return value;
  }
  return null;
}

function address(tags: Record<string, unknown>): string | null {
  const parts = [
    str(tags["addr:housenumber"]),
    str(tags["addr:street"]),
    str(tags["addr:suburb"]),
    first(tags, "addr:city", "addr:town", "addr:village"),
    str(tags["addr:postcode"]),
  ].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Ports sa_leads/osm.py's parse_elements -- maps a raw Overpass response
 * straight to ProviderCompany, skipping any element with no name tag.
 */
export function parseElements(payload: unknown): ProviderCompany[] {
  const body = payload as { elements?: unknown[] } | null;
  const elements = Array.isArray(body?.elements) ? body.elements : [];
  const companies: ProviderCompany[] = [];

  for (const el of elements) {
    const element = el as { type?: string; id?: number | string; tags?: Record<string, unknown> };
    const tags = element.tags ?? {};
    const name = first(tags, "name");
    if (!name || !element.type || element.id === undefined) continue;

    companies.push({
      externalId: `${element.type}/${element.id}`,
      source: SOURCE,
      name,
      registrationNumber: null,
      industry: first(tags, "shop", "office", "craft", "amenity", "tourism"),
      province: first(tags, "addr:state"),
      city: first(tags, "addr:city", "addr:town", "addr:village"),
      employeeCount: null,
      revenueRange: null,
      website: first(tags, "contact:website", "website"),
      phone: first(tags, "contact:phone", "phone"),
      email: first(tags, "contact:email", "email"),
      address: address(tags),
      contact: null,
    });
  }

  return companies;
}
