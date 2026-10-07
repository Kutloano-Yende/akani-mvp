const BASE = "https://api.hunter.io/v2";

export type HunterEmail = { value: string; type?: string };

/**
 * Hunter.io is strictly optional enrichment -- only called from
 * OsmProvider.enrich() when HUNTER_API_KEY is configured and the website
 * scrape found nothing. Server-only; never sent to the browser.
 */
export async function domainSearch(apiKey: string, domain: string, timeoutMs = 20_000): Promise<HunterEmail[]> {
  const url = new URL(`${BASE}/domain-search`);
  url.searchParams.set("domain", domain);
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Hunter domain search returned ${res.status}`);
  const body = await res.json();
  return Array.isArray(body?.data?.emails) ? body.data.emails : [];
}

export async function verifyEmail(apiKey: string, email: string, timeoutMs = 20_000): Promise<{ status: string | null }> {
  const url = new URL(`${BASE}/email-verifier`);
  url.searchParams.set("email", email);
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Hunter email verifier returned ${res.status}`);
  const body = await res.json();
  const status = typeof body?.data?.status === "string" ? body.data.status.toLowerCase() : null;
  return { status };
}
