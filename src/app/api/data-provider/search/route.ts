import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchProvider, scoreOpportunity } from "@/lib/data/provider";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const results = await searchProvider({
    industry: body.industry || undefined,
    province: body.province || undefined,
    employeesMin: body.employeesMin ? Number(body.employeesMin) : undefined,
    employeesMax: body.employeesMax ? Number(body.employeesMax) : undefined,
    keywords: body.keywords || undefined,
    city: body.city || undefined,
  });

  const { data: existing } = await supabase
    .from("companies")
    .select("external_id")
    .eq("source", "BDM DataFinder");
  const existingIds = new Set((existing ?? []).map((c) => c.external_id));

  const scored = results.map((company) => {
    const { score, level, signals } = scoreOpportunity(company);
    return {
      ...company,
      opportunityScore: score,
      opportunityLevel: level,
      signals,
      alreadyImported: existingIds.has(company.externalId),
    };
  });

  scored.sort((a, b) => b.opportunityScore - a.opportunityScore);

  return NextResponse.json({ results: scored });
}
