import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireRole(["admin", "manager"]);
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  const { id: prospectId } = await params;
  const { assigneeId } = await request.json();
  const supabase = await createClient();

  let assigneeName = "Unassigned";
  if (assigneeId) {
    const { data: assignee } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", assigneeId)
      .maybeSingle();
    if (!assignee) {
      return NextResponse.json({ error: "Team member not found" }, { status: 400 });
    }
    assigneeName = assignee.name;
  }

  const { data: updated, error } = await supabase
    .from("prospects")
    .update({ assigned_to: assigneeId || null })
    .eq("id", prospectId)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? "Prospect not found" }, { status: 404 });
  }

  await supabase.from("activities").insert({
    prospect_id: prospectId,
    user_id: check.userId,
    type: "ASSIGNED",
    description: assigneeId ? `Assigned to ${assigneeName}` : "Unassigned",
  });

  await logAudit(supabase, {
    action: "PROSPECT_ASSIGNED",
    entityType: "prospect",
    entityId: prospectId,
    metadata: { assigneeId: assigneeId || null },
  });

  return NextResponse.json({ success: true });
}
