import * as cheerio from "cheerio";

// Matches sa_leads/website.py's EMAIL_RE exactly (case-insensitive).
const EMAIL_RE = /(?<![\w.+-])([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})(?![\w.-])/gi;
const EMAIL_FULLMATCH_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const LINK_HINTS = ["contact", "about", "team", "company", "connect", "get-in-touch"];
// Only generic, publicly-published business mailboxes -- never a named
// individual's address. This is a hard boundary, not a v1 simplification.
const GENERIC_LOCAL_PARTS = new Set([
  "info", "hello", "contact", "sales", "admin", "office", "support", "enquiries",
  "inquiries", "marketing", "accounts", "bookings", "reception", "service", "help",
]);

export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function classifyEmail(email: string): "generic" | "other_public" {
  const local = email.split("@", 1)[0].toLowerCase();
  return GENERIC_LOCAL_PARTS.has(local) ? "generic" : "other_public";
}

export function extractEmails(html: string): string[] {
  const $ = cheerio.load(html);
  const found = new Set<string>();

  for (const match of $.text().matchAll(EMAIL_RE)) {
    found.add(match[1].toLowerCase());
  }

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href.toLowerCase().startsWith("mailto:")) return;
    const candidate = href.slice(7).split("?", 1)[0].trim();
    if (EMAIL_FULLMATCH_RE.test(candidate)) found.add(candidate.toLowerCase());
  });

  return Array.from(found).sort();
}

export function candidateLinks(baseUrl: string, html: string, limit: number): string[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const links: string[] = [];

  $("a[href]").each((_, el) => {
    if (links.length >= limit) return;
    const href = ($(el).attr("href") ?? "").trim();
    if (!href) return;
    let resolved: URL;
    try {
      resolved = new URL(href, baseUrl);
    } catch {
      return;
    }
    if (!/^https?:$/.test(resolved.protocol) || resolved.hostname !== base.hostname) return;
    const lower = resolved.toString().toLowerCase();
    if (!LINK_HINTS.some((hint) => lower.includes(hint))) return;
    const clean = resolved.toString().split("#", 1)[0];
    if (!seen.has(clean)) {
      seen.add(clean);
      links.push(clean);
    }
  });

  return links;
}

export type FoundEmail = { email: string; pageUrl: string; type: "generic" | "other_public" };

/**
 * Ports sa_leads/website.py's find_public_emails -- fetches the homepage
 * plus a small, capped number of same-domain pages whose URL contains a
 * contact/about-style hint word, and collects only clearly public
 * business addresses. Deliberately narrow: no following links off-domain,
 * no attempt to find or infer named-individual addresses.
 */
export async function findPublicEmails(
  website: string,
  opts: { maxPages?: number; timeoutMs?: number } = {},
): Promise<FoundEmail[]> {
  const { maxPages = 3, timeoutMs = 20_000 } = opts;
  const url = normalizeUrl(website);
  const headers = { "User-Agent": "Akani-Discovery/0.1 (public business contact discovery)" };

  const firstRes = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!firstRes.ok) throw new Error(`Website returned ${firstRes.status}`);
  const firstHtml = await firstRes.text();
  const firstUrl = firstRes.url || url;

  const pages = [firstUrl, ...candidateLinks(firstUrl, firstHtml, maxPages - 1)];
  const found = new Map<string, FoundEmail>();

  for (let i = 0; i < pages.length; i++) {
    const pageUrl = pages[i];
    const html =
      i === 0
        ? firstHtml
        : await fetch(pageUrl, { headers, signal: AbortSignal.timeout(timeoutMs) })
            .then((res) => (res.ok ? res.text() : null))
            .catch(() => null);
    if (html === null) continue;

    for (const email of extractEmails(html)) {
      if (!found.has(email)) found.set(email, { email, pageUrl, type: classifyEmail(email) });
    }
  }

  return Array.from(found.values());
}
