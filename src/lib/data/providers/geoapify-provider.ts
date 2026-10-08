import type { DataProvider, ProviderCompany, ProviderSearchParams } from "../types";
import { buildPlacesUrl, parsePlaces } from "./geoapify/places";
import { buildPlaceDetailsUrl, parsePlaceDetails } from "./geoapify/place-details";
import { mergeCompany } from "./companydata-provider";
// Both of these are fully provider-agnostic despite living in osm/ --
// reused as-is, not duplicated. See osm-provider.ts for the original use.
import { findPublicEmails } from "./osm/website-scraper";
import { domainSearch, verifyEmail } from "./osm/hunter";

const SOURCE = "Geoapify";

/**
 * Thrown for a bad search request (missing province, missing industry) --
 * distinguished from a transport/server failure so the API route can
 * surface this specific, actionable message instead of the generic
 * "provider unavailable" fallback. Mirrors OsmValidationError's role.
 */
export class GeoapifyValidationError extends Error {}

export class GeoapifyProvider implements DataProvider {
  readonly name = SOURCE;

  constructor(
    private readonly apiKey: string,
    private readonly hunterApiKey?: string,
  ) {}

  async search(params: ProviderSearchParams): Promise<ProviderCompany[]> {
    const built = buildPlacesUrl(params, this.apiKey);
    if (!built.ok) throw new GeoapifyValidationError(built.error);

    const res = await fetch(built.url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) this.fail(res.status, await this.errorDetail(res));

    const body = await res.json().catch(() => null);
    if (!body) throw new Error("Geoapify returned an unreadable response.");

    let companies = parsePlaces(body, params.industry ?? "", params.province ?? "");

    // City isn't sent to Geoapify at all -- same reasoning as the
    // OpenStreetMap provider: small South African places don't reliably
    // narrow a bounding-box search, so this only ever filters the parsed
    // results afterward.
    if (params.city) {
      const needle = params.city.trim().toLowerCase();
      companies = companies.filter((c) => c.city?.toLowerCase().includes(needle));
    }

    return companies;
  }

  /**
   * Ports the OpenStreetMap provider's exact enrichment precedence:
   * Place Details first (Geoapify's own contact data, when OSM -- its
   * underlying source -- happens to have it), then a scrape of the
   * company's own website, then optionally Hunter as a last resort.
   * Hunter stays fully optional throughout. Every external call is
   * wrapped so enrichment failure never breaks the import -- a company
   * must stay importable with blanks even if every step finds nothing.
   */
  async enrich(company: ProviderCompany): Promise<ProviderCompany | null> {
    let merged = company;

    try {
      const url = buildPlaceDetailsUrl(company.externalId, this.apiKey);
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        if (body) {
          const details = parsePlaceDetails(body);
          const full: ProviderCompany = {
            ...company,
            email: details.email,
            phone: details.phone,
            website: details.website,
            address: details.address ?? company.address,
          };
          merged = mergeCompany(company, full);
        }
      }
    } catch (err) {
      console.warn("Geoapify place details lookup failed", err);
    }

    let email = merged.email;

    if (!email && merged.website) {
      try {
        const found = await findPublicEmails(merged.website);
        found.sort((a, b) => (a.type === "generic" ? 0 : 1) - (b.type === "generic" ? 0 : 1));
        if (found.length > 0) email = found[0].email;
      } catch (err) {
        console.warn("Geoapify website scrape failed", err);
      }
    }

    if (!email && this.hunterApiKey && merged.website) {
      try {
        const domain = new URL(merged.website.startsWith("http") ? merged.website : `https://${merged.website}`).hostname.replace(/^www\./, "");
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
          email = null;
        }
      } catch (err) {
        console.warn("Hunter email verification failed", err);
      }
    }

    return { ...merged, email: email ?? merged.email };
  }

  private async errorDetail(res: Response): Promise<string> {
    // Geoapify is a modern JSON API (unlike Overpass's HTML error pages) --
    // exact field names are unconfirmed from docs alone, verified against
    // a real bad-key request during implementation.
    const body = await res.json().catch(() => null);
    return String(body?.message ?? body?.error ?? res.statusText);
  }

  private fail(status: number, detail: string): never {
    if (status === 401 || status === 403) {
      throw new Error(`Geoapify rejected the API key (${status}): ${detail}`);
    }
    if (status === 429) {
      throw new Error(`Geoapify's daily/rate limit was hit: ${detail}`);
    }
    throw new Error(`Geoapify search failed: ${status} ${detail}`);
  }
}
