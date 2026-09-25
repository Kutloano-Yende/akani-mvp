import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

// The lead functions in Postgres only act when given this secret, so that
// nobody holding the (public) anon key can start emails. It lives only in the
// server's environment.
export function leadsSecret(): string | null {
  return process.env.LEADS_SECRET?.trim() || null;
}

export class LeadsNotConfiguredError extends Error {
  constructor() {
    super("LEADS_SECRET is not set on the server.");
  }
}

function secretOrThrow(): string {
  const secret = leadsSecret();
  if (!secret) throw new LeadsNotConfiguredError();
  return secret;
}

export type LeadInput = {
  source: "website" | "permission" | "manual";
  name: string | null;
  email: string;
  phone?: string | null;
  company?: string | null;
  message?: string | null;
  prospectId?: string | null;
};

export type IntakeResult = {
  leadId: string;
  token: string;
  firstName: string | null;
  company: string | null;
  duplicate: boolean;
  suppressed: boolean;
};

export type DueLead = {
  leadId: string;
  email: string;
  firstName: string | null;
  company: string | null;
  token: string;
  step: number;
  source: string;
};

const asObject = (v: Json): Record<string, Json> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, Json>) : {};

export async function leadIntake(input: LeadInput): Promise<IntakeResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lead_intake", {
    p_secret: secretOrThrow(),
    p_source: input.source,
    p_name: input.name ?? "",
    p_email: input.email,
    p_phone: input.phone ?? "",
    p_company: input.company ?? "",
    p_message: input.message ?? "",
    ...(input.prospectId ? { p_prospect_id: input.prospectId } : {}),
  });
  if (error) throw new Error(error.message);

  const r = asObject(data);
  return {
    leadId: String(r.lead_id),
    token: String(r.token),
    firstName: typeof r.first_name === "string" ? r.first_name : null,
    company: typeof r.company === "string" ? r.company : null,
    duplicate: r.duplicate === true,
    suppressed: r.suppressed === true,
  };
}

export async function claimDueLeads(limit = 25): Promise<DueLead[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lead_claim_due", { p_secret: secretOrThrow(), p_limit: limit });
  if (error) throw new Error(error.message);

  return (Array.isArray(data) ? data : []).map((row) => {
    const r = asObject(row);
    return {
      leadId: String(r.lead_id),
      email: String(r.email),
      firstName: typeof r.first_name === "string" ? r.first_name : null,
      company: typeof r.company === "string" ? r.company : null,
      token: String(r.token),
      step: Number(r.step),
      source: String(r.source),
    };
  });
}

export async function recordLeadSend(args: {
  leadId: string;
  step: number;
  ok: boolean;
  error?: string | null;
  subject: string;
  nextAt: Date | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("lead_record_send", {
    p_secret: secretOrThrow(),
    p_lead_id: args.leadId,
    p_step: args.step,
    p_ok: args.ok,
    p_error: args.error ?? "",
    p_subject: args.subject,
    p_next_at: args.nextAt ? args.nextAt.toISOString() : (null as unknown as string),
  });
  if (error) throw new Error(error.message);
}
