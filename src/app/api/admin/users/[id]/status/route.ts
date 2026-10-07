import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole, requirePlatformAdmin } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Fast first pass -- either an own-tenant admin or a platform admin;
  // admin_set_user_status is the real enforcement below, re-checking
  // tenancy, self-action, and the last-platform-admin guard from auth.uid().
  const [roleCheck, platformCheck] = await Promise.all([requireRole(["admin"]), requirePlatformAdmin()]);
  if (!roleCheck.authorized && !platformCheck.authorized) {
    const status = !roleCheck.authorized && roleCheck.status === 401 ? 401 : 403;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }

  const { id: targetUserId } = await params;
  const { status } = await request.json();
  if (status !== "active" && status !== "suspended") {
    return NextResponse.json({ error: "status must be 'active' or 'suspended'" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_status", {
    target_user_id: targetUserId,
    new_status: status,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logAudit(supabase, {
    action: status === "suspended" ? "USER_SUSPENDED" : "USER_REACTIVATED",
    entityType: "profile",
    entityId: targetUserId,
  });

  return NextResponse.json({ success: true });
}
