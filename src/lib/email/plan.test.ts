import { describe, expect, it } from "vitest";
import { planRecipients } from "./plan";

type Row = Parameters<typeof planRecipients>[0][number] & { id: string };

const row = (id: string, company: Record<string, unknown> | null): Row =>
  ({ id, prospects: company ? { companies: company } : null }) as unknown as Row;

const none = new Set<string>();

describe("planRecipients", () => {
  it("prefers the first contact with an email, and uses their first name", () => {
    const [plan] = planRecipients(
      [
        row("1", {
          name: "Acme",
          email: "info@acme.co.za",
          contacts: [
            { first_name: "NoEmail", email: null },
            { first_name: "Sipho", email: "Sipho@Acme.co.za " },
          ],
        }),
      ],
      none,
    );
    expect(plan.to).toBe("sipho@acme.co.za");
    expect(plan.firstName).toBe("Sipho");
    expect(plan.companyName).toBe("Acme");
    expect(plan.suppressed).toBe(false);
  });

  it("falls back to the company address and a neutral greeting", () => {
    const [plan] = planRecipients([row("1", { name: "Acme", email: "Info@Acme.co.za", contacts: [] })], none);
    expect(plan.to).toBe("info@acme.co.za");
    expect(plan.firstName).toBe("there");
  });

  it("has no recipient when there is no email anywhere", () => {
    const [plan] = planRecipients([row("1", { name: "Acme", email: null, contacts: [{ first_name: "A", email: "  " }] })], none);
    expect(plan.to).toBeNull();
    expect(plan.suppressed).toBe(false);
  });

  it("suppresses when the contact address is on the list (case-insensitive)", () => {
    const [plan] = planRecipients(
      [row("1", { name: "Acme", email: "info@acme.co.za", contacts: [{ first_name: "S", email: "S@Acme.co.za" }] })],
      new Set(["s@acme.co.za"]),
    );
    expect(plan.suppressed).toBe(true);
  });

  it("suppresses when only the company address is on the list, even if a contact would be emailed", () => {
    const [plan] = planRecipients(
      [row("1", { name: "Acme", email: "info@acme.co.za", contacts: [{ first_name: "S", email: "s@acme.co.za" }] })],
      new Set(["info@acme.co.za"]),
    );
    expect(plan.suppressed).toBe(true);
  });

  it("copes with a single (non-array) contact and missing prospect data", () => {
    const plans = planRecipients(
      [row("1", { name: "Acme", email: null, contacts: { first_name: "Zed", email: "z@acme.co.za" } }), row("2", null)],
      none,
    );
    expect(plans[0].to).toBe("z@acme.co.za");
    expect(plans[1].to).toBeNull();
    expect(plans[1].companyName).toBe("your company");
  });
});
