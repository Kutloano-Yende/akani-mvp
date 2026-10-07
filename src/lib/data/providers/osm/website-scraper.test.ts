import { describe, expect, it, vi, afterEach } from "vitest";
import { classifyEmail, extractEmails, candidateLinks, normalizeUrl, findPublicEmails } from "./website-scraper";

describe("normalizeUrl", () => {
  it("prefixes https:// when no scheme is given", () => {
    expect(normalizeUrl("example.co.za")).toBe("https://example.co.za");
  });

  it("leaves an existing scheme alone", () => {
    expect(normalizeUrl("http://example.co.za")).toBe("http://example.co.za");
  });
});

describe("classifyEmail", () => {
  it("classifies a generic business mailbox", () => {
    expect(classifyEmail("info@example.co.za")).toBe("generic");
    expect(classifyEmail("Sales@Example.co.za")).toBe("generic");
  });

  it("classifies anything else as other_public", () => {
    expect(classifyEmail("john@example.co.za")).toBe("other_public");
  });
});

describe("extractEmails", () => {
  // Ports sa_leads/tests/test_website.py's test_extract_emails_and_mailto exactly.
  it("extracts emails from visible text and mailto: links", () => {
    const html = `
      <html><body>
        <p>Email info@example.co.za</p>
        <a href="mailto:sales@example.co.za?subject=Hello">Sales</a>
      </body></html>
    `;
    expect(extractEmails(html)).toEqual(["info@example.co.za", "sales@example.co.za"]);
  });

  it("dedupes and lowercases", () => {
    const html = `<p>INFO@Example.co.za and info@example.co.za</p>`;
    expect(extractEmails(html)).toEqual(["info@example.co.za"]);
  });

  it("ignores a malformed mailto href", () => {
    const html = `<a href="mailto:not-an-email">Broken</a>`;
    expect(extractEmails(html)).toEqual([]);
  });

  it("returns nothing when there's no email on the page", () => {
    expect(extractEmails("<p>No contact details here.</p>")).toEqual([]);
  });
});

describe("candidateLinks", () => {
  it("keeps only same-domain links whose URL contains a contact-ish hint word", () => {
    const html = `
      <a href="/contact-us">Contact</a>
      <a href="/about">About</a>
      <a href="/products">Products</a>
      <a href="https://other-domain.com/contact">External contact</a>
    `;
    const links = candidateLinks("https://example.co.za", html, 5);
    expect(links).toEqual(["https://example.co.za/contact-us", "https://example.co.za/about"]);
  });

  it("caps the number of returned links", () => {
    const html = `<a href="/contact">C</a><a href="/about">A</a><a href="/team">T</a>`;
    expect(candidateLinks("https://example.co.za", html, 1)).toHaveLength(1);
  });

  it("dedupes links that differ only by fragment", () => {
    const html = `<a href="/contact#top">A</a><a href="/contact#bottom">B</a>`;
    expect(candidateLinks("https://example.co.za", html, 5)).toEqual(["https://example.co.za/contact"]);
  });
});

describe("findPublicEmails", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers emails found on the homepage, then any hinted subpages, first-found-wins", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u === "https://example.co.za/") {
        return {
          ok: true,
          url: u,
          text: async () => `<html><body>Home <a href="/contact">Contact</a></body></html>`,
        } as Response;
      }
      if (u === "https://example.co.za/contact") {
        return {
          ok: true,
          text: async () => `<p>Reach us: info@example.co.za</p>`,
        } as Response;
      }
      throw new Error(`unexpected fetch ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const found = await findPublicEmails("https://example.co.za/");
    expect(found).toEqual([{ email: "info@example.co.za", pageUrl: "https://example.co.za/contact", type: "generic" }]);
  });

  it("throws if the homepage itself fails to load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, url: "https://example.co.za/", text: async () => "" }) as Response),
    );
    await expect(findPublicEmails("https://example.co.za/")).rejects.toThrow();
  });

  it("skips (not throws) a subpage that fails to load", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u === "https://example.co.za/") {
        return {
          ok: true,
          url: u,
          text: async () => `<a href="/contact">Contact</a>`,
        } as Response;
      }
      return { ok: false, status: 500, text: async () => "" } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(findPublicEmails("https://example.co.za/")).resolves.toEqual([]);
  });
});
