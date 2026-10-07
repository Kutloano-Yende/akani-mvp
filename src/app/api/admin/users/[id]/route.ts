import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  const { id: targetUserId } = await params;
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Ask another admin to delete your own account." }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Deleting users needs SUPABASE_SERVICE_ROLE_KEY configured on the server." },
      { status: 501 },
    );
  }

  const [{ data: callerProfile }, { data: callerIsPlatformAdmin }] = await Promise.all([
    supabase.from("profiles").select("role, tenant_id").eq("id", user.id).single(),
    supabase.rpc("is_platform_admin"),
  ]);

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const [{ data: targetProfile }, { data: targetIsPlatformAdminRow }] = await Promise.all([
    admin.from("profiles").select("name, tenant_id").eq("id", targetUserId).single(),
    admin.from("platform_admins").select("user_id").eq("user_id", targetUserId).maybeSingle(),
  ]);
  if (!targetProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const targetIsPlatformAdmin = !!targetIsPlatformAdminRow;

  if (targetIsPlatformAdmin) {
    if (!callerIsPlatformAdmin) {
      return NextResponse.json(
        { error: "Only a platform admin can delete another platform admin." },
        { status: 403 },
      );
    }
    const { count } = await admin.from("platform_admins").select("user_id", { count: "exact", head: true });
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "Can't delete the last remaining platform admin." }, { status: 400 });
    }
  } else if (!callerIsPlatformAdmin) {
    if (callerProfile?.role !== "admin" || callerProfile.tenant_id !== targetProfile.tenant_id) {
      return NextResponse.json(
        { error: "Only an admin for this user's tenant (or a platform admin) can delete them." },
        { status: 403 },
      );
    }
  }

  // Pre-check, not an afterthought: a real delete cascades profiles but
  // every other table referencing a user (audit_logs, leads, feedback,
  // impersonation_sessions, etc.) uses a plain restrict FK, so deleting
  // anyone with real history throws a foreign-key violation. This gives a
  // clear message instead of a raw DB error.
  const { data: hasHistory, error: historyError } = await supabase.rpc("user_has_history", {
    target_user_id: targetUserId,
  });
  if (historyError) {
    return NextResponse.json({ error: historyError.message }, { status: 500 });
  }
  if (hasHistory) {
    return NextResponse.json(
      {
        error: "Can't delete — this account has activity on record (leads, audit logs, etc.). Suspend them instead.",
      },
      { status: 409 },
    );
  }

  await logAudit(supabase, {
    action: "USER_DELETED",
    entityType: "profile",
    entityId: targetUserId,
    metadata: { name: targetProfile.name },
  });

  const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
