type Contact = { first_name: string | null; email: string | null };
type Company = {
  name: string;
  email: string | null;
  contacts?: Contact[] | Contact | null;
};
type Prospect = { companies: Company | Company[] | null };

export type PendingRow = {
  prospects: Prospect | Prospect[] | null;
};

export type Plan<R extends PendingRow> = {
  row: R;
  to: string | null;
  firstName: string;
  companyName: string;
  suppressed: boolean;
};

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

const clean = (email: string | null | undefined) => email?.trim().toLowerCase() || null;

// Decides, for each pending campaign row, who the email goes to and whether it
// must be skipped. Kept pure so the compliance rules can be tested directly.
export function planRecipients<R extends PendingRow>(
  rows: R[],
  suppressedEmails: Set<string>,
): Plan<R>[] {
  return rows.map((row) => {
    const company = one(one(row.prospects)?.companies);
    const contacts = Array.isArray(company?.contacts)
      ? company.contacts
      : company?.contacts
        ? [company.contacts]
        : [];
    const contact = contacts.find((c) => clean(c.email)) ?? null;

    const contactEmail = clean(contact?.email);
    const companyEmail = clean(company?.email);

    return {
      row,
      to: contactEmail ?? companyEmail,
      firstName: contact?.first_name?.trim() || "there",
      companyName: company?.name ?? "your company",
      // A suppressed address on either the contact or the company blocks the send.
      suppressed: [contactEmail, companyEmail].some((e) => e !== null && suppressedEmails.has(e)),
    };
  });
}
