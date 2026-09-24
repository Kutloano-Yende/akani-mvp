import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

// ilike treats % and _ as wildcards and \ as the escape character; an email
// containing them must match literally, never widen the match.
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function findSubjectRecords(supabase: Client, email: string) {
  const pattern = escapeLike(normalizeEmail(email));

  const [{ data: contacts }, { data: companies }] = await Promise.all([
    supabase.from("contacts").select("*").ilike("email", pattern),
    supabase.from("companies").select("*").ilike("email", pattern),
  ]);

  const companyIds = [
    ...new Set([
      ...(contacts ?? []).map((c) => c.company_id),
      ...(companies ?? []).map((c) => c.id),
    ]),
  ];

  return { contacts: contacts ?? [], companies: companies ?? [], companyIds };
}

// Everything the system holds that is linked to this email address, for a
// POPIA data-subject access request.
export async function collectSubjectData(supabase: Client, email: string) {
  const { contacts, companies, companyIds } = await findSubjectRecords(supabase, email);
  const normalized = normalizeEmail(email);

  if (companyIds.length === 0) {
    const { data: suppression } = await supabase
      .from("suppression_list")
      .select("email, phone, reason, source, created_at")
      .ilike("email", escapeLike(normalized));
    return {
      subject: normalized,
      contacts,
      companies,
      linkedCompanies: [],
      prospects: [],
      signals: [],
      activities: [],
      campaignParticipation: [],
      applications: [],
      conversions: [],
      suppression: suppression ?? [],
    };
  }

  const [{ data: linkedCompanies }, { data: prospects }, { data: signals }, { data: suppression }] =
    await Promise.all([
      supabase.from("companies").select("id, name, registration_number, industry, province, city").in("id", companyIds),
      supabase.from("prospects").select("*").in("company_id", companyIds),
      supabase.from("opportunity_signals").select("*").in("company_id", companyIds),
      supabase
        .from("suppression_list")
        .select("email, phone, reason, source, created_at")
        .ilike("email", escapeLike(normalized)),
    ]);

  const prospectIds = (prospects ?? []).map((p) => p.id);

  const [activities, campaignParticipation, applications, conversions] = prospectIds.length
    ? await Promise.all([
        supabase.from("activities").select("*").in("prospect_id", prospectIds),
        supabase.from("campaign_prospects").select("*").in("prospect_id", prospectIds),
        supabase.from("applications").select("*").in("prospect_id", prospectIds),
        supabase.from("conversions").select("*").in("prospect_id", prospectIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  return {
    subject: normalized,
    contacts,
    companies,
    linkedCompanies: linkedCompanies ?? [],
    prospects: prospects ?? [],
    signals: signals ?? [],
    activities: activities.data ?? [],
    campaignParticipation: campaignParticipation.data ?? [],
    applications: applications.data ?? [],
    conversions: conversions.data ?? [],
    suppression: suppression ?? [],
  };
}
