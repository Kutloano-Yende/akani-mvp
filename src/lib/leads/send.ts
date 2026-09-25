import { sendEmail, sendingUnavailable } from "@/lib/email/provider";
import { buildLeadEmail } from "./sequence";
import { nextEmailAt } from "./sequence";
import { recordLeadSend, type DueLead } from "./db";

// Sends one step of the sequence to a lead, records the outcome, and schedules
// the next email. Never throws for a delivery failure: that is recorded so the
// lead is retried later.
export async function sendLeadEmail(
  lead: Pick<DueLead, "leadId" | "email" | "firstName" | "company" | "token" | "source" | "step">,
  appUrl: string,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  // Nothing is recorded: the lead stays due and goes out once sending is configured.
  if (sendingUnavailable()) return { ok: false, skipped: true, error: "Email sending isn't configured." };

  const email = buildLeadEmail(
    lead.step,
    { firstName: lead.firstName, companyName: lead.company, source: lead.source, token: lead.token },
    appUrl,
  );

  const result = await sendEmail({
    to: lead.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
    unsubscribeUrl: email.unsubscribeUrl,
  });

  await recordLeadSend({
    leadId: lead.leadId,
    step: lead.step,
    ok: result.ok,
    error: result.ok ? null : result.error,
    subject: email.subject,
    nextAt: result.ok ? nextEmailAt(lead.step, new Date()) : null,
  });

  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
