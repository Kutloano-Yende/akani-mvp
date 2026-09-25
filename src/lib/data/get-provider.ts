import type { DataProvider } from "./types";
import { MockProvider } from "./providers/mock-provider";
import { CompanyDataProvider } from "./providers/companydata-provider";

let cached: DataProvider | null = null;

/**
 * Returns the configured business-data provider. Falls back to the mock
 * catalogue until COMPANYDATA_API_KEY is set, so Discover Businesses works
 * end-to-end before credentials exist.
 */
export function getProvider(): DataProvider {
  if (cached) return cached;

  const apiKey = process.env.COMPANYDATA_API_KEY;
  cached = apiKey
    ? new CompanyDataProvider(
        apiKey,
        process.env.COMPANYDATA_BASE_URL || undefined,
        Number(process.env.COMPANYDATA_PAGE_SIZE) || undefined,
      )
    : new MockProvider();

  return cached;
}
