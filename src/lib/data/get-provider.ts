import type { DataProvider } from "./types";
import { MockProvider } from "./providers/mock-provider";
import { CompanyDataProvider } from "./providers/companydata-provider";
import { LushaProvider } from "./providers/lusha-provider";
import { OsmProvider } from "./providers/osm-provider";

let cached: DataProvider | null = null;
let cachedOsm: DataProvider | null = null;

/**
 * Returns the configured business-data provider. Lusha is preferred when
 * LUSHA_API_KEY is set (replacing CompanyData for Discover Businesses);
 * CompanyData is kept as a fallback if only its key is set, so switching
 * providers is a config change, not a code change. Falls back to the mock
 * catalogue until either key exists, so Discover Businesses works
 * end-to-end before credentials exist.
 */
export function getProvider(): DataProvider {
  if (cached) return cached;

  if (process.env.LUSHA_API_KEY) {
    cached = new LushaProvider(process.env.LUSHA_API_KEY, Number(process.env.LUSHA_PAGE_SIZE) || undefined);
  } else if (process.env.COMPANYDATA_API_KEY) {
    cached = new CompanyDataProvider(
      process.env.COMPANYDATA_API_KEY,
      process.env.COMPANYDATA_BASE_URL || undefined,
      Number(process.env.COMPANYDATA_PAGE_SIZE) || undefined,
    );
  } else {
    cached = new MockProvider();
  }

  return cached;
}

/**
 * The OpenStreetMap provider is deliberately NOT part of getProvider()'s
 * fallback chain -- unlike Lusha/CompanyData/Mock, it needs no API key, so
 * if it were added as a further fallback it would simply never run in
 * production (LUSHA_API_KEY is already configured there). It's reached
 * only when a caller explicitly asks for it, via the `provider: "osm"`
 * param on /api/data-provider/search -- a separate, always-available
 * source to broaden coverage, not a backup for when the paid ones are down.
 */
export function getOsmProvider(): DataProvider {
  if (cachedOsm) return cachedOsm;
  cachedOsm = new OsmProvider(process.env.OVERPASS_URL || undefined, process.env.HUNTER_API_KEY || undefined);
  return cachedOsm;
}

/**
 * Picks the right provider instance for a company that already exists
 * (import-time enrich, "Refresh contact details") based on which provider
 * originally sourced it -- getProvider() alone would be wrong here for an
 * OSM-sourced company, since it always returns whichever paid provider is
 * currently configured, regardless of where this particular company
 * actually came from.
 */
export function resolveProviderFor(source: string): DataProvider {
  return source === getOsmProvider().name ? getOsmProvider() : getProvider();
}
