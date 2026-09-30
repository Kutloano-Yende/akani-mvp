import { createClient } from "@/lib/supabase/server";
import { TOKEN_PATTERN } from "@/lib/unsubscribe";

export type LeadReplyResult =
  | { ok: false }
  | { ok: true; ackNeeded: false; leadId: string }
  | {
      ok: true;
      ackNeeded: true;
      leadId: string;
      email: string;
      firstName: string | null;
      name: string | null;
      company: string | null;
      token: string;
    };

// Marks a lead as replied and stops its follow-up sequence, idempotently.
// See lead_reply_received in the sprint18 migration for the authoritative
// logic -- this just validates the token shape and shapes the response.
export async function recordLeadReply(token: string): Promise<LeadReplyResult> {
  if (!TOKEN_PATTERN.test(token)) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lead_reply_received", { p_token: token });
  if (error || !data) return { ok: false };

  const r = data as Record<string, unknown>;
  if (r.ok !== true) return { ok: false };
  if (r.ack_needed !== true) return { ok: true, ackNeeded: false, leadId: String(r.lead_id) };

  return {
    ok: true,
    ackNeeded: true,
    leadId: String(r.lead_id),
    email: String(r.email),
    firstName: typeof r.first_name === "string" ? r.first_name : null,
    name: typeof r.name === "string" ? r.name : null,
    company: typeof r.company === "string" ? r.company : null,
    token: String(r.token),
  };
}

// Records whether the canned acknowledgment email sent, for observability
// and idempotency (a second call for the same lead is a no-op upsert).
export async function recordLeadReplyAck(token: string, ok: boolean, error: string | null): Promise<void> {
  if (!TOKEN_PATTERN.test(token)) return;
  const supabase = await createClient();
  await supabase.rpc("lead_record_reply_ack", { p_token: token, p_ok: ok, p_error: error ?? "" });
}
