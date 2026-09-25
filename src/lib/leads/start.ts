import { leadIntake, type LeadInput } from "./db";
import { sendLeadEmail } from "./send";

export type StartLeadResult = {
  leadId: string;
  // False for a repeat submission or an address that must not be emailed.
  emailed: boolean;
  duplicate: boolean;
  suppressed: boolean;
};

// Creates a lead and sends the instant reply straight away, so the first
// response goes out within seconds of the lead arriving. If that email fails,
// the lead stays due and the scheduled run retries it.
export async function startLead(input: LeadInput, appUrl: string): Promise<StartLeadResult> {
  const lead = await leadIntake(input);
  if (lead.duplicate || lead.suppressed) {
    return { leadId: lead.leadId, emailed: false, duplicate: lead.duplicate, suppressed: lead.suppressed };
  }

  const result = await sendLeadEmail(
    {
      leadId: lead.leadId,
      email: input.email.trim().toLowerCase(),
      firstName: lead.firstName,
      company: lead.company,
      token: lead.token,
      source: input.source,
      step: 1,
    },
    appUrl,
  );

  return { leadId: lead.leadId, emailed: result.ok, duplicate: false, suppressed: false };
}
