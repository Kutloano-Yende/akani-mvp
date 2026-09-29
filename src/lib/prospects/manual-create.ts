import type { SupabaseClient } from "@supabase/supabase-js";
import { findDuplicate, type DedupeCandidate } from "@/lib/data/dedupe";
import { withServerTenant } from "@/lib/supabase/tenant-insert";
import type { Database } from "@/types/database";

export type ManualProspectRow = {
  companyName: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  industry?: string | null;
  province?: string | null;
  city?: string | null;
  website?: string | null;
};

export type ManualCreateResult =
  | { ok: true; prospectId: string; companyId: string; alreadyExisted: boolean; dedupedAgainst: string | null }
  | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateManualRow(row: ManualProspectRow): string | null {
  if (!row.companyName?.trim()) return "Missing company name";
  if (!row.email?.trim() || !EMAIL_PATTERN.test(row.email.trim())) return "Missing or invalid email";
  return null;
}

/**
 * Shared by the single "Add prospect" form and the CSV bulk upload — both
 * create a company + contact + prospect (status "qualified", ready to add
 * to a campaign straight away) from data the user supplies directly, unlike
 * a Discover import there's no provider enrichment step to run.
 *
 * `candidates` is mutated in place: a company created partway through a CSV
 * batch is pushed onto it, so a later row for the same company in the same
 * upload merges onto that record instead of creating a duplicate.
 */
export async function createManualProspect(
  supabase: SupabaseClient<Database>,
  userId: string,
  source: string,
  row: ManualProspectRow,
  candidates: DedupeCandidate[],
): Promise<ManualCreateResult> {
  const invalid = validateManualRow(row);
  if (invalid) return { ok: false, error: invalid };

  const duplicate = findDuplicate(row.companyName, null, candidates);
  const dedupedAgainst = duplicate?.id ?? null;
  let companyId = duplicate?.id ?? null;

  if (!companyId) {
    const { data: inserted, error: insertError } = await supabase
      .from("companies")
      .insert(
        withServerTenant({
          name: row.companyName.trim(),
          source,
          industry: row.industry?.trim() || null,
          province: row.province?.trim() || null,
          city: row.city?.trim() || null,
          website: row.website?.trim() || null,
        }),
      )
      .select("id")
      .single();

    if (insertError || !inserted) {
      return { ok: false, error: insertError?.message ?? "Failed to create company" };
    }
    companyId = inserted.id;
    candidates.push({ id: companyId, name: row.companyName.trim(), registrationNumber: null });
  }

  const { data: existingProspect } = await supabase
    .from("prospects")
    .select("id")
    .eq("company_id", companyId)
    .maybeSingle();

  if (existingProspect) {
    return { ok: true, prospectId: existingProspect.id, companyId, alreadyExisted: true, dedupedAgainst };
  }

  await supabase.from("contacts").insert(
    withServerTenant({
      company_id: companyId,
      first_name: row.firstName?.trim() || null,
      last_name: row.lastName?.trim() || null,
      job_title: row.jobTitle?.trim() || null,
      email: row.email.trim().toLowerCase(),
      phone: row.phone?.trim() || null,
      source,
    }),
  );

  const { data: prospect, error: prospectError } = await supabase
    .from("prospects")
    .insert(
      withServerTenant({
        company_id: companyId,
        status: "qualified" as const,
        assigned_to: userId,
      }),
    )
    .select("id")
    .single();

  if (prospectError || !prospect) {
    return { ok: false, error: prospectError?.message ?? "Failed to create prospect" };
  }

  await supabase.from("activities").insert(
    withServerTenant({
      prospect_id: prospect.id,
      user_id: userId,
      type: "PROSPECT_IMPORTED",
      description: dedupedAgainst
        ? `Added manually via ${source} (matched to an existing company record)`
        : `Added manually via ${source}`,
    }),
  );

  return { ok: true, prospectId: prospect.id, companyId, alreadyExisted: false, dedupedAgainst };
}
