import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";

const ALLOWED = ["replied", "closed"] as const;

// Staff mark a lead as replied or closed, which stops any further emails.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireRole(["admin", "manager"]);
  if (!check.authorized) return NextResponse.json({ error: "Forbidden" }, { status: check.status });

  const { id } = await params;
  const { status } = await request.json();
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: "Status must be replied or closed" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ status, next_action_at: null })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Lead not found" }, { status: 404 });
  }

  await logAudit(supabase, { action: "LEAD_UPDATED", entityType: "lead", entityId: id, metadata: { status } });
  return NextResponse.json({ success: true });
}
