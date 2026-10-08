import type { DataProvider } from "./types";
import { MockProvider } from "./providers/mock-provider";
import { CompanyDataProvider } from "./providers/companydata-provider";
import { LushaProvider } from "./providers/lusha-provider";
import { OsmProvider } from "./providers/osm-provider";
import { GeoapifyProvider } from "./providers/geoapify-provider";

let cached: DataProvider | null = null;
let cachedOsm: DataProvider | null = null;
let cachedGeoapify: DataProvider | null = null;

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
 * The OpenStreetMap provider is kept in place but is no longer reachable
 * from Discover Businesses' UI or the search route's `provider` param --
 * the free public Overpass instance proved unreliable in production
 * (confirmed directly, and in OSM's own docs: "do not expect high
 * reliability", "commercial use should use self-hosted or paid Overpass
 * servers") and has been replaced by getGeoapifyProvider() below. This
 * function stays exported, and OsmProvider stays imported, specifically
 * so resolveProviderFor() can still correctly route any company that was
 * already imported from OpenStreetMap before the switch -- removing this
 * would silently break "Refresh contact details" for those rows.
 */
export function getOsmProvider(): DataProvider {
  if (cachedOsm) return cachedOsm;
  cachedOsm = new OsmProvider(process.env.OVERPASS_URL || undefined, process.env.HUNTER_API_KEY || undefined);
  return cachedOsm;
}

/**
 * Geoapify is the current free-tier discovery source -- a commercial,
 * SLA-backed API (unlike the public Overpass instance it replaced), reached
 * only via an explicit `provider: "geoapify"` opt-in, never silently
 * replacing Lusha/CompanyData when they're configured.
 */
export function getGeoapifyProvider(): DataProvider {
  if (cachedGeoapify) return cachedGeoapify;
  cachedGeoapify = new GeoapifyProvider(process.env.GEOAPIFY_API_KEY ?? "", process.env.HUNTER_API_KEY || undefined);
  return cachedGeoapify;
}

/**
 * Picks the right provider instance for a company that already exists
 * (import-time enrich, "Refresh contact details") based on which provider
 * originally sourced it -- getProvider() alone would be wrong here for a
 * Geoapify- or OpenStreetMap-sourced company, since it always returns
 * whichever paid provider is currently configured, regardless of where
 * this particular company actually came from.
 */
export function resolveProviderFor(source: string): DataProvider {
  if (source === getGeoapifyProvider().name) return getGeoapifyProvider();
  if (source === getOsmProvider().name) return getOsmProvider();
  return getProvider();
}
