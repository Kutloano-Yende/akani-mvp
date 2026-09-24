import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";
import { toCsv, csvResponse } from "@/lib/csv";

const MAX_ROWS = 5000;

export async function GET() {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  const supabase = await createClient();
  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select("created_at, action, entity_type, entity_id, ip_address, metadata, profiles(name)")
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (logs ?? []).map((l) => {
    const actor = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
    return [
      l.created_at, actor?.name ?? "System", l.action, l.entity_type, l.entity_id,
      l.ip_address, l.metadata ? JSON.stringify(l.metadata) : "",
    ];
  });

  await logAudit(supabase, {
    action: "AUDIT_LOGS_EXPORTED",
    entityType: "audit_log",
    metadata: { rows: rows.length },
  });

  const csv = toCsv(["When (UTC)", "Who", "Action", "Entity type", "Entity id", "IP address", "Details"], rows);
  return csvResponse(csv, `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
}
