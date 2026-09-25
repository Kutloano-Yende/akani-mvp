import { describe, expect, it } from "vitest";
import { escapeHtml, renderSubject, renderTemplate, textToHtml } from "./render";

const vars = { firstName: "Anele", companyName: "Cape Coastal" };

describe("renderTemplate", () => {
  it("fills the documented placeholders, tolerating spaces", () => {
    expect(renderTemplate("Hi {{firstName}}, {{ companyName }}!", vars)).toBe("Hi Anele, Cape Coastal!");
  });

  it("renders unknown placeholders as empty rather than leaking raw tokens", () => {
    expect(renderTemplate("a{{bogus}}b", vars)).toBe("ab");
  });

  it("fills a placeholder every time it appears", () => {
    expect(renderTemplate("{{firstName}} {{firstName}}", vars)).toBe("Anele Anele");
  });
});

describe("renderSubject", () => {
  it("collapses newlines so a value can't inject extra headers", () => {
    expect(renderSubject("Hello {{companyName}}\r\nBcc: evil@x.com", vars)).toBe(
      "Hello Cape Coastal Bcc: evil@x.com",
    );
  });
});

describe("html output", () => {
  it("escapes markup", () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });

  it("turns blank lines into paragraphs and single newlines into <br>", () => {
    expect(textToHtml("one\ntwo\n\nthree")).toBe("<p>one<br>two</p>\n<p>three</p>");
  });

  it("neutralises scripts, including ones smuggled in via variables", () => {
    const body = renderTemplate("Hi {{companyName}}", { firstName: "x", companyName: "<script>alert(1)</script>" });
    expect(textToHtml(body)).not.toContain("<script>");
  });
});
