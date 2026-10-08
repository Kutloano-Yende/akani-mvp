import type { DataProvider, ProviderCompany, ProviderSearchParams } from "../types";
import { buildQuery } from "./osm/query";
import { parseElements } from "./osm/parse";
import { findPublicEmails } from "./osm/website-scraper";
import { domainSearch, verifyEmail } from "./osm/hunter";

const SOURCE = "OpenStreetMap";
const DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter";

/**
 * Thrown for a bad search request (missing province, missing
 * industry/keyword) -- distinguished from a transport/server failure so
 * the API route can surface this specific, actionable message instead of
 * the generic "provider unavailable" fallback it uses for everything else.
 */
export class OsmValidationError extends Error {}

export class OsmProvider implements DataProvider {
  readonly name = SOURCE;

  constructor(
    private readonly overpassUrl: string = DEFAULT_OVERPASS_URL,
    private readonly hunterApiKey?: string,
  ) {}

  async search(params: ProviderSearchParams): Promise<ProviderCompany[]> {
    const built = buildQuery(params);
    if (!built.ok) throw new OsmValidationError(built.error);

    const res = await this.fetchWithRetry(built.query);
    if (!res.ok) this.fail(res.status, await this.errorDetail(res));

    const body = await res.json().catch(() => null);
    if (!body) throw new Error("OpenStreetMap returned an unreadable response.");

    let companies = parseElements(body);

    // City isn't reliable as an Overpass-level filter (confirmed against
    // the real API: named small-place areas often don't resolve) -- only
    // ever applied here, against whatever city tag came back.
    if (params.city) {
      const needle = params.city.trim().toLowerCase();
      companies = companies.filter((c) => c.city?.toLowerCase().includes(needle));
    }

    return companies;
  }

  /**
   * Ports sa_leads/pipeline.py's enrich_lead precedence exactly: try the
   * website scrape first (prefer a generic-classified email); only if
   * that finds nothing AND Hunter is configured, fall back to Hunter's
   * domain search; verify via Hunter only as an internal confidence
   * check -- an email that fails verification is simply not used, rather
   * than persisting a status field nothing downstream reads. Enrichment
   * failure must never break the import, so every external call here is
   * wrapped and swallowed.
   */
  async enrich(company: ProviderCompany): Promise<ProviderCompany | null> {
    if (!company.website) return company;

    let email: string | null = null;

    try {
      const found = await findPublicEmails(company.website);
      found.sort((a, b) => (a.type === "generic" ? 0 : 1) - (b.type === "generic" ? 0 : 1));
      if (found.length > 0) email = found[0].email;
    } catch (err) {
      console.warn("OpenStreetMap website scrape failed", err);
    }

    if (!email && this.hunterApiKey) {
      try {
        const domain = new URL(company.website.startsWith("http") ? company.website : `https://${company.website}`).hostname.replace(/^www\./, "");
        if (domain) {
          const emails = await domainSearch(this.hunterApiKey, domain);
          const candidate = emails.find((e) => e.type === "generic") ?? emails[0];
          if (candidate?.value) email = candidate.value;
        }
      } catch (err) {
        console.warn("Hunter domain search failed", err);
      }
    }

    if (email && this.hunterApiKey) {
      try {
        const { status } = await verifyEmail(this.hunterApiKey, email);
        if (status && status !== "valid" && status !== "accept_all") {
          // Low-confidence result -- don't hand back an email we have
          // reason to think is bad.
          email = null;
        }
      } catch (err) {
        console.warn("Hunter email verification failed", err);
      }
    }

    return { ...company, email: email ?? company.email };
  }

  // Confirmed against the real public instance during development: it's
  // prone to multi-minute stretches of overload, not just single blips --
  // so this one retry won't fix a sustained bad patch, but it's a cheap,
  // real improvement for the more common case of a brief hiccup. Each
  // attempt gets a generous enough budget to actually see Overpass's own
  // response (success or its own timeout page, both typically arrive
  // well under 25s) rather than our own AbortSignal firing first; two
  // attempts plus the gap stays safely under typical serverless function
  // time limits.
  private async fetchWithRetry(query: string): Promise<Response> {
    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      // Overpass's public instance rejects requests with no identifiable
      // client (406 Not Acceptable) -- confirmed in production: every
      // manual curl test during development set this explicitly and
      // never hit the issue, but Node's native fetch sends no
      // User-Agent by default, and every real deployed request failed
      // with 406 until this was added.
      "User-Agent": "Akani-Discovery/0.1 (South African business discovery, https://akani-mvp.vercel.app)",
    };

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(this.overpassUrl, {
          method: "POST",
          headers,
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(25_000),
        });
        if (res.ok || attempt === 2) return res;
      } catch (err) {
        if (attempt === 2) throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    throw new Error("OpenStreetMap request failed.");
  }

  private async errorDetail(res: Response): Promise<string> {
    const text = await res.text().catch(() => "");
    // Overpass error responses are an HTML page, not JSON -- pull out the
    // one line that actually says what went wrong, if present.
    const match = text.match(/<strong[^>]*>Error<\/strong>:\s*([^<]+)/i);
    return (match?.[1] ?? res.statusText).trim();
  }

  private fail(status: number, detail: string): never {
    if (status === 504 || status === 429 || /too busy|timeout/i.test(detail)) {
      throw new Error(`OpenStreetMap is busy right now — try a narrower search or try again shortly. (${detail})`);
    }
    throw new Error(`OpenStreetMap search failed: ${status} ${detail}`);
  }
}
