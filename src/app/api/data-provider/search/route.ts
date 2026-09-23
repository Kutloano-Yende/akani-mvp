import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProvider, scoreOpportunity } from "@/lib/data/provider";
import { findDuplicate } from "@/lib/data/dedupe";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Each search burns a real provider credit — cap per-user rate so a
  // runaway client (or a compromised session) can't exhaust the account's
  // credit balance.
  const limit = rateLimit(`data-provider-search:${user.id}`, 20, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many searches. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const body = await request.json();

  const provider = getProvider();
  let results;
  try {
    results = await provider.search({
      industry: body.industry || undefined,
      province: body.province || undefined,
      employeesMin: body.employeesMin ? Number(body.employeesMin) : undefined,
      employeesMax: body.employeesMax ? Number(body.employeesMax) : undefined,
      keywords: body.keywords || undefined,
      city: body.city || undefined,
    });
  } catch (err) {
    console.error(`${provider.name} search failed`, err);
    return NextResponse.json(
      { error: `${provider.name} is unavailable right now. Try again shortly.` },
      { status: 502 },
    );
  }

  const { data: existingCompanies } = await supabase
    .from("companies")
    .select("id, name, external_id, source, registration_number");

  const exactMatches = new Set(
    (existingCompanies ?? []).map((c) => `${c.external_id ?? ""}::${c.source ?? ""}`),
  );
  const candidates = (existingCompanies ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    registrationNumber: c.registration_number,
  }));

  const scored = results.map((company) => {
    const { score, level, signals } = scoreOpportunity(company);
    const alreadyImported = exactMatches.has(`${company.externalId}::${company.source}`);
    const duplicate = alreadyImported
      ? null
      : findDuplicate(company.name, company.registrationNumber, candidates);

    return {
      ...company,
      opportunityScore: score,
      opportunityLevel: level,
      signals,
      alreadyImported,
      possibleDuplicateOf: duplicate?.name ?? null,
    };
  });

  scored.sort((a, b) => b.opportunityScore - a.opportunityScore);

  await supabase.from("api_usage").insert({
    user_id: user.id,
    provider: provider.name,
    endpoint: "data-provider/search",
    results_returned: scored.length,
    credits_used: 1,
  });

  return NextResponse.json({ results: scored });
}
