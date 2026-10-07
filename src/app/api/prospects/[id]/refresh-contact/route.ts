import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scoreOpportunity, type ProviderCompany } from "@/lib/data/provider";
import { resolveProviderFor } from "@/lib/data/get-provider";
import { mergeCompany } from "@/lib/data/providers/companydata-provider";
import { dailyLimitReached } from "@/lib/data/usage";
import { rateLimit } from "@/lib/rate-limit";
import { checkProspectAccess } from "@/lib/auth/prospect-access";
import { logAudit } from "@/lib/audit";
import { withServerTenant } from "@/lib/supabase/tenant-insert";

/**
 * Re-runs the provider's enrich step for a company already in the pipeline —
 * for when a bug or data update means a prior import came through with no
 * contact details (see the Lusha phone/email field-name fix this endpoint
 * was built to backfill). Same billable enrich call import already makes
 * for a brand new company, just triggerable again later instead of only at
 * import time.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: prospectId } = await params;
  const access = await checkProspectAccess(supabase, user.id, prospectId);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: prospect } = await supabase
    .from("prospects")
    .select("company_id, companies(*)")
    .eq("id", prospectId)
    .single();
  const company = prospect && (Array.isArray(prospect.companies) ? prospect.companies[0] : prospect.companies);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const provider = resolveProviderFor(company.source ?? "");
  if (!provider.enrich || company.source !== provider.name) {
    return NextResponse.json(
      { error: `${company.source ?? "This source"} doesn't support refreshing contact details.` },
      { status: 400 },
    );
  }
  if (!company.external_id) {
    return NextResponse.json({ error: "This company has no provider ID to look up." }, { status: 400 });
  }

  const limit = rateLimit(`refresh-contact:${user.id}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests. Wait a moment and try again." }, { status: 429 });
  }
  if (await dailyLimitReached(supabase, provider.name)) {
    return NextResponse.json({ error: "The daily search limit has been reached. It resets at midnight UTC." }, { status: 429 });
  }

  const asProviderCompany: ProviderCompany = {
    externalId: company.external_id,
    source: company.source ?? provider.name,
    name: company.name,
    registrationNumber: company.registration_number,
    industry: company.industry,
    province: company.province,
    city: company.city,
    employeeCount: company.employee_count,
    revenueRange: company.revenue_range,
    website: company.website,
    phone: company.phone,
    email: company.email,
    address: company.address,
    contact: null,
  };

  const full = await provider.enrich(asProviderCompany);
  if (!full) {
    return NextResponse.json({ error: `${provider.name} couldn't refresh this company's details right now.` }, { status: 502 });
  }

  const merged = mergeCompany(asProviderCompany, full);
  const { score, level } = scoreOpportunity(merged);

  const { error: updateError } = await supabase
    .from("companies")
    .update({
      registration_number: merged.registrationNumber,
      industry: merged.industry,
      province: merged.province,
      city: merged.city,
      employee_count: merged.employeeCount,
      revenue_range: merged.revenueRange,
      website: merged.website,
      phone: merged.phone,
      email: merged.email,
      address: merged.address,
      opportunity_score: score,
      opportunity_level: level,
    })
    .eq("id", company.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabase.from("api_usage").insert({
    user_id: user.id,
    provider: provider.name,
    endpoint: "data-provider/refresh-contact",
    results_returned: 1,
    credits_used: 1,
  });

  await supabase.from("activities").insert(withServerTenant({
    prospect_id: prospectId,
    user_id: user.id,
    type: "CONTACT_REFRESHED",
    description: `Refreshed contact details from ${provider.name}`,
  }));

  await logAudit(supabase, {
    action: "CONTACT_REFRESHED",
    entityType: "company",
    entityId: company.id,
    metadata: { gotEmail: !!merged.email, gotPhone: !!merged.phone },
  });

  return NextResponse.json({ success: true, email: merged.email, phone: merged.phone });
}
