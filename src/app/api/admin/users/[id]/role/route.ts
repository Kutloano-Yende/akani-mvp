import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";
import type { Enums } from "@/types/database";

const VALID_ROLES: Enums<"user_role">[] = ["admin", "manager", "sales"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  const { id: targetUserId } = await params;
  const { role } = await request.json();

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const supabase = await createClient();

  // The RPC itself re-checks the caller is admin and blocks self-role
  // changes — this route's requireRole() check is a fast first pass, not
  // the only line of defense.
  const { error } = await supabase.rpc("admin_update_user_role", {
    target_user_id: targetUserId,
    new_role: role,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logAudit(supabase, {
    action: "ROLE_CHANGED",
    entityType: "profile",
    entityId: targetUserId,
    metadata: { newRole: role },
  });

  return NextResponse.json({ success: true });
}
