import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/like";
import { rateLimit } from "@/lib/rate-limit";

const MAX_RESULTS = 8;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = rateLimit(`search:${user.id}`, 60, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many searches — slow down a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });

  const pattern = `%${escapeLike(q)}%`;

  const [{ data: byName }, { data: byFirst }, { data: byLast }] = await Promise.all([
    supabase.from("companies").select("id").ilike("name", pattern).limit(20),
    supabase.from("contacts").select("company_id").ilike("first_name", pattern).limit(20),
    supabase.from("contacts").select("company_id").ilike("last_name", pattern).limit(20),
  ]);

  const companyIds = [
    ...new Set([
      ...(byName ?? []).map((c) => c.id),
      ...(byFirst ?? []).map((c) => c.company_id),
      ...(byLast ?? []).map((c) => c.company_id),
    ]),
  ];
  if (companyIds.length === 0) return NextResponse.json({ results: [] });

  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, status, companies(name, industry)")
    .in("company_id", companyIds)
    .limit(MAX_RESULTS);

  const results = (prospects ?? []).map((p) => {
    const company = Array.isArray(p.companies) ? p.companies[0] : p.companies;
    return {
      id: p.id,
      name: company?.name ?? "Unknown",
      industry: company?.industry ?? null,
      status: p.status,
    };
  });

  return NextResponse.json({ results });
}
