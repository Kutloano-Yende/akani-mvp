import { getEmailMode } from "@/lib/email/provider";
import { claimDueLeads } from "./db";
import { sendLeadEmail } from "./send";

// Resend's default limit is 2 requests/second.
const LIVE_DELAY_MS = 600;

// Sends every follow-up that is due. Run on a schedule.
export async function processDueLeads(appUrl: string, limit = 25) {
  const due = await claimDueLeads(limit);
  let sent = 0;
  let failed = 0;
  let held = 0;

  for (const lead of due) {
    const result = await sendLeadEmail(lead, appUrl);
    if (result.ok) sent++;
    else if (result.skipped) held++;
    else failed++;
    if (getEmailMode() === "live") await new Promise((r) => setTimeout(r, LIVE_DELAY_MS));
  }

  return { due: due.length, sent, failed, held };
}
