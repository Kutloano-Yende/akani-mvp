import { describe, expect, it } from "vitest";
import { buildCampaignEmail } from "./campaign-email";

const recipient = { firstName: "Anele", companyName: "Cape Coastal", token: "11111111-2222-4333-8444-555555555555" };
const app = "https://akani.example.co.za";

const plain = { subject: "Hello {{companyName}}", body: "Hi {{firstName}},\n\nAbout {{companyName}}.", include_permission_buttons: false };
const asking = { ...plain, subject: "May we stay in touch, {{firstName}}?", include_permission_buttons: true };

describe("buildCampaignEmail", () => {
  it("personalises the subject and body", () => {
    const e = buildCampaignEmail(plain, recipient, app, {});
    expect(e.subject).toBe("Hello Cape Coastal");
    expect(e.html).toContain("Hi Anele,");
    expect(e.text).toContain("About Cape Coastal.");
  });

  it("always includes a tokenised unsubscribe link", () => {
    const e = buildCampaignEmail(plain, recipient, app, {});
    expect(e.unsubscribeUrl).toBe(`${app}/unsubscribe/${recipient.token}`);
    expect(e.html).toContain(e.unsubscribeUrl);
    expect(e.text).toContain(e.unsubscribeUrl);
  });

  it("adds Yes and No links carrying the recipient's token when the template asks permission", () => {
    const e = buildCampaignEmail(asking, recipient, app, {});
    expect(e.subject).toBe("May we stay in touch, Anele?");
    expect(e.html).toContain(`${app}/permission/${recipient.token}?answer=yes`);
    expect(e.html).toContain(`${app}/permission/${recipient.token}?answer=no`);
    expect(e.html).toContain("May we keep in touch?");
    expect(e.text).toContain(`Yes, keep in touch: ${app}/permission/${recipient.token}?answer=yes`);
  });

  it("has no permission buttons for an ordinary template", () => {
    const e = buildCampaignEmail(plain, recipient, app, {});
    expect(e.html).not.toContain("/permission/");
  });

  it("uses the branded layout with the default sign-off and sender", () => {
    const e = buildCampaignEmail(plain, recipient, app, {});
    expect(e.html).toContain("#050058");
    expect(e.html).toContain("The Akani team");
    expect(e.html).toContain("Sent by Akani BEE Ratings.");
    expect(e.html).toContain(`src="${app}/email/akani-logo.png"`);
  });

  it("takes sender name, sign-off and address from the environment", () => {
    const e = buildCampaignEmail(plain, recipient, app, {
      EMAIL_SENDER_NAME: "Akani Advisory",
      EMAIL_SIGN_OFF: "Kind regards,\nLerato",
      EMAIL_FOOTER_ADDRESS: "1 Main Rd, Sandton",
    });
    expect(e.html).toContain("Sent by Akani Advisory.");
    expect(e.html).toContain("Lerato");
    expect(e.html).toContain("1 Main Rd, Sandton");
  });

  it("can't be used to inject markup through the company name", () => {
    const e = buildCampaignEmail(plain, { ...recipient, companyName: "<script>alert(1)</script>" }, app, {});
    expect(e.html).not.toContain("<script>");
  });
});
