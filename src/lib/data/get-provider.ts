import type { DataProvider } from "./types";
import { MockProvider } from "./providers/mock-provider";
import { BDMDataFinderProvider } from "./providers/bdm-provider";

let cached: DataProvider | null = null;

/**
 * Returns the configured business-data provider. Falls back to the mock
 * catalogue until BDM_DATAFINDER_API_KEY / BDM_DATAFINDER_BASE_URL are set,
 * so Discover Businesses works end-to-end before real credentials exist.
 */
export function getProvider(): DataProvider {
  if (cached) return cached;

  const apiKey = process.env.BDM_DATAFINDER_API_KEY;
  const baseUrl = process.env.BDM_DATAFINDER_BASE_URL;

  cached =
    apiKey && baseUrl ? new BDMDataFinderProvider(apiKey, baseUrl) : new MockProvider();

  return cached;
}
