import { headers, cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";
import { IMPERSONATION_COOKIE, IMPERSONATION_MAX_AGE_SECONDS } from "@/lib/impersonation";

// A real session swap, not a permissions bypass: once this returns, the
// browser is, as far as every existing RLS policy and page is concerned,
// genuinely the target user. See the migration's comment and the plan this
// was built from for why.
export async function POST(request: Request) {
  const check = await requirePlatformAdmin();
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Impersonation needs SUPABASE_SERVICE_ROLE_KEY configured on the server." },
      { status: 501 },
    );
  }

  const body = await request.json().catch(() => null);
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : null;
  if (!targetUserId) return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
  if (targetUserId === check.userId) {
    return NextResponse.json({ error: "You can't impersonate yourself" }, { status: 400 });
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const [{ data: targetProfile }, { data: isTargetPlatformAdmin }, { data: targetAuthUser, error: targetAuthError }] =
    await Promise.all([
      admin.from("profiles").select("name, tenants(name, status)").eq("id", targetUserId).single(),
      admin.from("platform_admins").select("user_id").eq("user_id", targetUserId).maybeSingle(),
      admin.auth.admin.getUserById(targetUserId),
    ]);

  if (!targetProfile || targetAuthError || !targetAuthUser.user?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (isTargetPlatformAdmin) {
    return NextResponse.json({ error: "Platform admins can't be impersonated" }, { status: 403 });
  }
  const targetTenant = Array.isArray(targetProfile.tenants) ? targetProfile.tenants[0] : targetProfile.tenants;
  if (targetTenant?.status === "suspended") {
    return NextResponse.json({ error: "That user's tenant is suspended" }, { status: 403 });
  }

  // Logged on the admin's own still-active session, the one moment logAudit's
  // trigger-based attribution (set_audit_user_id) correctly points at them --
  // after the swap below, the session is the target's, not the admin's.
  const supabase = await createClient();
  await logAudit(supabase, {
    action: "IMPERSONATION_STARTED",
    entityType: "user",
    entityId: targetUserId,
    metadata: { targetName: targetProfile.name, targetTenant: targetTenant?.name ?? null },
  });

  const { data: session, error: sessionError } = await admin
    .from("impersonation_sessions")
    .insert({ admin_id: check.userId, target_user_id: targetUserId })
    .select("id")
    .single();
  if (sessionError || !session) {
    return NextResponse.json({ error: "Failed to start impersonation" }, { status: 500 });
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: targetAuthUser.user.email,
  });
  if (linkError || !link?.properties?.hashed_token) {
    return NextResponse.json({ error: "Failed to start impersonation" }, { status: 500 });
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) {
    return NextResponse.json({ error: "Failed to start impersonation" }, { status: 500 });
  }

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, session.id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: IMPERSONATION_MAX_AGE_SECONDS,
    path: "/",
  });

  const h = await headers();
  const origin = h.get("origin") ?? new URL(request.url).origin;
  return NextResponse.json({ ok: true, redirect: `${origin}/dashboard` });
}
