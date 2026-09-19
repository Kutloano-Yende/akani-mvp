import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ProviderCompany } from "@/lib/data/provider";
import { findDuplicate } from "@/lib/data/dedupe";

type ImportBody = {
  company: ProviderCompany;
  opportunityScore: number;
  opportunityLevel: "low" | "medium" | "high";
  signals: { signalType: string; description: string; weight: number }[];
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: ImportBody = await request.json();
  const { company, opportunityScore, opportunityLevel, signals } = body;

  const { data: exactMatch } = await supabase
    .from("companies")
    .select("id")
    .eq("external_id", company.externalId)
    .eq("source", company.source)
    .maybeSingle();

  let companyId = exactMatch?.id;
  let dedupedAgainst: string | null = null;

  // No exact (external_id, source) match — check whether this is the same
  // real-world business under a different id (registration number or
  // normalized name match) before creating a new company row.
  if (!companyId) {
    const { data: candidates } = await supabase
      .from("companies")
      .select("id, name, registration_number");

    const duplicate = findDuplicate(
      company.name,
      company.registrationNumber,
      (candidates ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        registrationNumber: c.registration_number,
      })),
    );

    if (duplicate) {
      companyId = duplicate.id;
      dedupedAgainst = duplicate.id;
    }
  }

  if (!companyId) {
    const { data: inserted, error: insertError } = await supabase
      .from("companies")
      .insert({
        external_id: company.externalId,
        source: company.source,
        name: company.name,
        registration_number: company.registrationNumber,
        industry: company.industry,
        province: company.province,
        city: company.city,
        employee_count: company.employeeCount,
        revenue_range: company.revenueRange,
        website: company.website,
        phone: company.phone,
        email: company.email,
        address: company.address,
        opportunity_score: opportunityScore,
        opportunity_level: opportunityLevel,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to import company" },
        { status: 500 },
      );
    }
    companyId = inserted.id;

    if (company.contact) {
      await supabase.from("contacts").insert({
        company_id: companyId,
        first_name: company.contact.firstName,
        last_name: company.contact.lastName,
        job_title: company.contact.jobTitle,
        email: company.contact.email,
        phone: company.contact.phone,
        source: company.source,
      });
    }

    if (signals.length) {
      const insertedCompanyId = companyId;
      await supabase.from("opportunity_signals").insert(
        signals.map((s) => ({
          company_id: insertedCompanyId,
          signal_type: s.signalType,
          description: s.description,
          weight: s.weight,
          source: company.source,
        })),
      );
    }
  }

  const { data: existingProspect } = await supabase
    .from("prospects")
    .select("id")
    .eq("company_id", companyId)
    .maybeSingle();

  if (existingProspect) {
    return NextResponse.json({
      prospectId: existingProspect.id,
      alreadyExisted: true,
      dedupedAgainst,
    });
  }

  const { data: prospect, error: prospectError } = await supabase
    .from("prospects")
    .insert({
      company_id: companyId,
      status: "identified",
      opportunity_score: opportunityScore,
    })
    .select("id")
    .single();

  if (prospectError || !prospect) {
    return NextResponse.json(
      { error: prospectError?.message ?? "Failed to create prospect" },
      { status: 500 },
    );
  }

  await supabase.from("activities").insert({
    prospect_id: prospect.id,
    user_id: user.id,
    type: "PROSPECT_IMPORTED",
    description: dedupedAgainst
      ? `Imported from ${company.source} (matched to an existing company record)`
      : `Imported from ${company.source}`,
  });

  return NextResponse.json({ prospectId: prospect.id, alreadyExisted: false, dedupedAgainst });
}
