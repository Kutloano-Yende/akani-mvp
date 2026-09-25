import { describe, expect, it } from "vitest";
import { buildLeadEmail, FOLLOW_UP_GAPS_DAYS, nextEmailAt, TOTAL_EMAILS } from "./sequence";

const lead = { firstName: "Thandi", companyName: "Nkosi Co", source: "website", token: "11111111-2222-4333-8444-555555555555" };
const app = "https://akani.example.co.za";

describe("the sequence shape", () => {
  it("is one instant reply plus three follow-ups", () => {
    expect(TOTAL_EMAILS).toBe(4);
    expect(FOLLOW_UP_GAPS_DAYS).toHaveLength(3);
  });
});

describe("nextEmailAt", () => {
  // Times are 07:00 in Johannesburg (UTC+2) = 05:00 UTC.
  it("schedules the first follow-up the next weekday morning", () => {
    const monday = new Date("2026-09-28T10:00:00Z");
    expect(nextEmailAt(1, monday)!.toISOString()).toBe("2026-09-29T05:00:00.000Z");
  });

  it("rolls a weekend due date to Monday", () => {
    const friday = new Date("2026-09-25T10:00:00Z");
    // Friday + 1 day is Saturday, so Monday.
    expect(nextEmailAt(1, friday)!.toISOString()).toBe("2026-09-28T05:00:00.000Z");
    // Thursday + 2 days is Saturday, so Monday.
    expect(nextEmailAt(2, new Date("2026-09-24T10:00:00Z"))!.toISOString()).toBe("2026-09-28T05:00:00.000Z");
  });

  it("spaces the follow-ups at about 1, 3 and 6 days", () => {
    let now = new Date("2026-09-28T10:00:00Z"); // Monday
    const sends: string[] = [];
    for (const step of [1, 2, 3]) {
      const at = nextEmailAt(step, now)!;
      sends.push(at.toISOString().slice(0, 10));
      now = at;
    }
    // Tue 29, then +2 days = Thu 1 Oct, then +3 days = Sun 4 Oct -> Mon 5 Oct.
    expect(sends).toEqual(["2026-09-29", "2026-10-01", "2026-10-05"]);
  });

  it("never lands on a weekend", () => {
    let now = new Date("2026-09-20T10:00:00Z");
    for (let i = 0; i < 40; i++) {
      for (const step of [1, 2, 3]) {
        const at = nextEmailAt(step, now)!;
        const day = new Date(at.getTime() + 2 * 3_600_000).getUTCDay();
        expect([0, 6]).not.toContain(day);
      }
      now = new Date(now.getTime() + 86_400_000);
    }
  });

  it("ends the sequence after the last email", () => {
    expect(nextEmailAt(4, new Date())).toBeNull();
    expect(nextEmailAt(5, new Date())).toBeNull();
    expect(nextEmailAt(0, new Date())).toBeNull();
  });
});

describe("buildLeadEmail", () => {
  it("has a different subject for each of the four emails", () => {
    const subjects = [1, 2, 3, 4].map((s) => buildLeadEmail(s, lead, app, {}).subject);
    expect(new Set(subjects).size).toBe(4);
    for (const s of subjects) expect(s).toContain("Thandi");
  });

  it("links the booking page and unsubscribe with the lead's token", () => {
    const e = buildLeadEmail(1, lead, app, {});
    expect(e.bookingUrl).toBe(`${app}/book/${lead.token}`);
    expect(e.unsubscribeUrl).toBe(`${app}/unsubscribe/${lead.token}`);
    expect(e.html).toContain(e.bookingUrl);
    expect(e.html).toContain(e.unsubscribeUrl);
    expect(e.html).toContain("Choose a time");
    expect(e.text).toContain(`Choose a time: ${e.bookingUrl}`);
  });

  it("mentions the company when known and copes without a name or company", () => {
    expect(buildLeadEmail(1, lead, app, {}).text).toContain("about Nkosi Co");
    const anon = buildLeadEmail(1, { ...lead, firstName: null, companyName: null }, app, {});
    expect(anon.text).toContain("Hi there,");
    expect(anon.text).not.toContain("about null");
  });

  it("never puts a placeholder name in a subject line", () => {
    for (const step of [1, 2, 3, 4]) {
      const subject = buildLeadEmail(step, { ...lead, firstName: null }, app, {}).subject;
      expect(subject).not.toMatch(/there/i);
      expect(subject).not.toMatch(/,\s*[?]/);
      expect(subject.length).toBeGreaterThan(10);
    }
  });

  it("says the last email is the last one", () => {
    expect(buildLeadEmail(4, lead, app, {}).text.toLowerCase()).toContain("last");
  });

  it("explains why it was sent, differently for a yes-clicker", () => {
    expect(buildLeadEmail(1, lead, app, {}).text).toContain("you contacted Akani BEE Ratings");
    expect(buildLeadEmail(1, { ...lead, source: "permission" }, app, {}).text).toContain("happy to hear from us");
  });

  it("uses the official brand", () => {
    const e = buildLeadEmail(1, lead, app, {});
    expect(e.html).toContain("#050058");
    expect(e.html).toContain(`${app}/email/akani-logo.png`);
  });

  it("cannot be used to inject markup through the name", () => {
    const e = buildLeadEmail(1, { ...lead, firstName: "<script>x</script>", companyName: "<img src=x>" }, app, {});
    expect(e.html).not.toMatch(/<script>|<img src=x>/);
  });
});
