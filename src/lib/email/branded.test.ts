import { describe, expect, it } from "vitest";
import { renderBrandedEmail, safeUrl } from "./branded";

const base = {
  subject: "May we stay in touch?",
  bodyText: "Hi Anele,\n\nWe help businesses with B-BBEE.",
  reason: "You're receiving this because Acme was identified as a possible fit.",
  unsubscribeUrl: "https://app.example.co.za/unsubscribe/abc",
};

describe("safeUrl", () => {
  it("allows http(s) and rejects everything else", () => {
    expect(safeUrl("https://a.co.za/x?y=1")).toBe("https://a.co.za/x?y=1");
    expect(safeUrl("http://a.co.za")).toBe("http://a.co.za/");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,<script>")).toBeNull();
    expect(safeUrl("not a url")).toBeNull();
  });
});

describe("renderBrandedEmail", () => {
  it("uses the official Akani BEE Ratings colours", () => {
    const { html } = renderBrandedEmail(base);
    expect(html).toContain("#050058");
    expect(html).toContain("#ce9b01");
    expect(html).not.toContain("#07124c");
  });

  it("shows the logo image with brand alt text when a logo URL is given", () => {
    const { html } = renderBrandedEmail({ ...base, logoUrl: "https://app.example.co.za/email/akani-logo.png" });
    expect(html).toContain('src="https://app.example.co.za/email/akani-logo.png"');
    expect(html).toContain('alt="Akani BEE Ratings"');
  });

  it("falls back to a text wordmark without a logo, and refuses an unsafe logo URL", () => {
    for (const logoUrl of [undefined, null, "javascript:alert(1)"]) {
      const { html } = renderBrandedEmail({ ...base, logoUrl });
      expect(html).not.toContain("<img");
      expect(html).toContain("BEE RATINGS");
    }
  });

  it("signs off with the brand tagline", () => {
    const { html, text } = renderBrandedEmail(base);
    expect(html).toContain("Together we build");
    expect(text).toContain("Together we build");
  });

  it("turns blank lines into paragraphs and keeps single newlines as breaks", () => {
    const { html } = renderBrandedEmail({ ...base, bodyText: "one\ntwo\n\nthree" });
    expect(html).toContain("one<br>two");
    expect(html.match(/<p /g)?.length).toBe(2);
  });

  it("escapes markup in the body, subject, reason and sender", () => {
    const { html } = renderBrandedEmail({
      ...base,
      subject: "<script>x</script>",
      bodyText: "<img src=x onerror=alert(1)>",
      reason: "<b>why</b>",
      senderName: "<i>Bad</i>",
    });
    expect(html).not.toMatch(/<script>|<img |<b>why|<i>Bad/);
    expect(html).toContain("&lt;img");
  });

  it("includes the permission panel with both links only when given", () => {
    const withPanel = renderBrandedEmail({
      ...base,
      permission: { yesUrl: "https://app/permission/t?answer=yes", noUrl: "https://app/permission/t?answer=no" },
    });
    expect(withPanel.html).toContain("May we keep in touch?");
    expect(withPanel.html).toContain("answer=yes");
    expect(withPanel.html).toContain("answer=no");
    expect(withPanel.text).toContain("Yes, keep in touch: https://app/permission/t?answer=yes");

    const without = renderBrandedEmail(base);
    expect(without.html).not.toContain("May we keep in touch?");
  });

  it("drops the permission panel if either link is unsafe", () => {
    const { html } = renderBrandedEmail({
      ...base,
      permission: { yesUrl: "javascript:alert(1)", noUrl: "https://ok.co.za" },
    });
    expect(html).not.toContain("May we keep in touch?");
    expect(html).not.toContain("javascript:");
  });

  it("renders action buttons and skips unsafe ones", () => {
    const { html, text } = renderBrandedEmail({
      ...base,
      buttons: [
        { label: "Book a call", url: "https://app/book/t" },
        { label: "Evil", url: "javascript:alert(1)" },
      ],
    });
    expect(html).toContain("Book a call");
    expect(html).not.toContain("Evil");
    expect(text).toContain("Book a call: https://app/book/t");
  });

  it("always explains why the email was sent and offers unsubscribe", () => {
    const { html, text } = renderBrandedEmail(base);
    expect(html).toContain("You're receiving this because Acme");
    expect(html).toContain("https://app.example.co.za/unsubscribe/abc");
    expect(text).toContain("Unsubscribe: https://app.example.co.za/unsubscribe/abc");
  });

  it("omits unsubscribe when there is no link, and shows the address when given", () => {
    const { html } = renderBrandedEmail({ ...base, unsubscribeUrl: null, address: "1 Main Rd, Sandton" });
    expect(html).not.toContain("Unsubscribe");
    expect(html).toContain("1 Main Rd, Sandton");
  });

  it("adds a hidden preheader only when provided", () => {
    expect(renderBrandedEmail({ ...base, preheader: "A quick yes or no" }).html).toContain("A quick yes or no");
    expect(renderBrandedEmail(base).html).not.toContain("display:none");
  });

  it("produces a plain-text version with no HTML", () => {
    const { text } = renderBrandedEmail({ ...base, buttons: [{ label: "Go", url: "https://x.co.za" }] });
    expect(text).not.toMatch(/<[a-z]/i);
    expect(text).toContain("Hi Anele,");
  });
});
