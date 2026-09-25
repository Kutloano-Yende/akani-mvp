import { describe, expect, it } from "vitest";
import { buildIcs } from "./ics";

const base = {
  uid: "abc-123@akani",
  start: new Date("2026-09-28T08:00:00Z"),
  end: new Date("2026-09-28T08:30:00Z"),
  summary: "Call with Akani BEE Ratings",
  now: new Date("2026-09-25T10:00:00Z"),
};

describe("buildIcs", () => {
  it("produces a valid calendar with CRLF line endings", () => {
    const ics = buildIcs(base);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("writes times in UTC in iCalendar format", () => {
    const ics = buildIcs(base);
    expect(ics).toContain("DTSTART:20260928T080000Z");
    expect(ics).toContain("DTEND:20260928T083000Z");
    expect(ics).toContain("DTSTAMP:20260925T100000Z");
    expect(ics).toContain("UID:abc-123@akani");
  });

  it("escapes commas, semicolons, backslashes and newlines in text", () => {
    const ics = buildIcs({ ...base, description: "Line one\nLine two; with, punctuation \\ done" });
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\; with\\, punctuation \\\\ done");
  });

  it("folds long lines to 75 octets or fewer", () => {
    const ics = buildIcs({ ...base, description: "word ".repeat(80) });
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    // Unfolding restores the original text.
    expect(ics.replace(/\r\n /g, "")).toContain("DESCRIPTION:" + "word ".repeat(80));
  });

  it("folds multibyte text without splitting a character", () => {
    const ics = buildIcs({ ...base, description: "é".repeat(100) });
    expect(ics.replace(/\r\n /g, "")).toContain("é".repeat(100));
  });

  it("includes organizer and attendee when given", () => {
    const ics = buildIcs({
      ...base,
      organizer: { name: "Akani BEE Ratings", email: "hello@akani.co.za" },
      attendee: { name: 'Thandi "T" Nkosi', email: "thandi@nkosi.co.za" },
    });
    expect(ics).toContain('ORGANIZER;CN="Akani BEE Ratings":mailto:hello@akani.co.za');
    expect(ics).toContain("ATTENDEE;CN=\"Thandi 'T' Nkosi\";RSVP=TRUE:mailto:thandi@nkosi.co.za");
  });

  it("marks a cancellation", () => {
    const ics = buildIcs({ ...base, method: "CANCEL" });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(buildIcs(base)).toContain("STATUS:CONFIRMED");
  });
});
