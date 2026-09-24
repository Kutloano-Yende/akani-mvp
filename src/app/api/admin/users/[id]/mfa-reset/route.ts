import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";

/**
 * Removes a user's enrolled 2FA factors so they can sign in and re-enrol
 * (e.g. after losing their phone). Removing another user's factors needs
 * the service-role key — there's no way to do it from a normal session —
 * so this returns 501 until SUPABASE_SERVICE_ROLE_KEY is configured.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  const { id: targetUserId } = await params;

  if (targetUserId === check.userId) {
    return NextResponse.json(
      { error: "Manage your own 2FA from the Security tab." },
      { status: 400 },
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          "Resetting another user's 2FA needs SUPABASE_SERVICE_ROLE_KEY configured on the server. Add it to .env.local (Supabase dashboard > Project Settings > API) and restart.",
      },
      { status: 501 },
    );
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: targetUserId });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const factors = data?.factors ?? [];
  for (const factor of factors) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: targetUserId,
    });
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }
  }

  const supabase = await createClient();
  await logAudit(supabase, {
    action: "MFA_RESET",
    entityType: "profile",
    entityId: targetUserId,
    metadata: { factorsRemoved: factors.length },
  });

  return NextResponse.json({ success: true, factorsRemoved: factors.length });
}
