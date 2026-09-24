import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { toCsv, csvResponse } from "@/lib/csv";
import type { Enums } from "@/types/database";

const STATUSES: Enums<"prospect_status">[] = [
  "identified", "qualified", "contacted", "interested", "application", "won", "lost",
];

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = rateLimit(`export-prospects:${user.id}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many exports — try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const onlyMine = params.get("mine") === "1";

  let query = supabase
    .from("prospects")
    .select(
      "status, opportunity_score, first_contacted_at, last_contacted_at, created_at, companies(name, registration_number, industry, province, city, employee_count, revenue_range), profiles(name)",
    )
    .order("created_at", { ascending: false });

  if (status && STATUSES.includes(status as Enums<"prospect_status">)) {
    query = query.eq("status", status as Enums<"prospect_status">);
  }
  if (onlyMine) query = query.eq("assigned_to", user.id);

  const { data: prospects, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const date = (v: string | null) => (v ? v.slice(0, 10) : "");
  const rows = (prospects ?? []).map((p) => {
    const company = Array.isArray(p.companies) ? p.companies[0] : p.companies;
    const owner = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    return [
      company?.name, company?.registration_number, company?.industry, company?.province,
      company?.city, company?.employee_count, company?.revenue_range, p.opportunity_score,
      p.status, owner?.name ?? "Unassigned", date(p.first_contacted_at), date(p.last_contacted_at),
      date(p.created_at),
    ];
  });

  await logAudit(supabase, {
    action: "PROSPECTS_EXPORTED",
    entityType: "prospect",
    metadata: { rows: rows.length, status: status ?? "all", mine: onlyMine },
  });

  const csv = toCsv(
    [
      "Company", "Registration no.", "Industry", "Province", "City", "Employees", "Revenue range",
      "Opportunity score", "Status", "Owner", "First contacted", "Last contacted", "Created",
    ],
    rows,
  );
  return csvResponse(csv, `prospects-${new Date().toISOString().slice(0, 10)}.csv`);
}
