import type { DataProvider } from "./types";
import { MockProvider } from "./providers/mock-provider";
import { CompanyDataProvider } from "./providers/companydata-provider";
import { LushaProvider } from "./providers/lusha-provider";

let cached: DataProvider | null = null;

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
