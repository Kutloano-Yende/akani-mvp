import { describe, expect, it } from "vitest";
import { buildFeedbackNotification } from "./email";

const app = "https://akani.example.co.za";
const fb = { name: "Thandi Nkosi", role: "sales", email: "thandi@akani.example.co.za", message: "The export button is broken.", pagePath: "/prospects" };

describe("buildFeedbackNotification", () => {
  it("names the submitter in the subject and body", () => {
    const e = buildFeedbackNotification(fb, app, {});
    expect(e.subject).toBe("New feedback from Thandi Nkosi");
    expect(e.text).toContain("Thandi Nkosi (sales)");
    expect(e.text).toContain("thandi@akani.example.co.za");
    expect(e.text).toContain("The export button is broken.");
  });

  it("includes the page the user was on when given", () => {
    const e = buildFeedbackNotification(fb, app, {});
    expect(e.text).toContain("/prospects");
  });

  it("omits the page line when none is given", () => {
    const e = buildFeedbackNotification({ ...fb, pagePath: null }, app, {});
    expect(e.text).not.toContain("Page:");
  });

  it("has no unsubscribe link, since it's a direct transactional notice", () => {
    const e = buildFeedbackNotification(fb, app, {});
    expect(e.html).not.toContain("Unsubscribe");
  });

  it("cannot be used to inject markup through the message", () => {
    const e = buildFeedbackNotification({ ...fb, name: "<script>x</script>", message: "<img src=x>" }, app, {});
    expect(e.html).not.toMatch(/<script>|<img src=x>/);
  });
});
