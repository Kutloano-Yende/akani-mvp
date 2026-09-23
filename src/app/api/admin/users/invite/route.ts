import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";
import type { Enums } from "@/types/database";

/**
 * Creates a new user account. Unlike role changes, this genuinely needs
 * the service-role key (auth.admin.createUser isn't available from a
 * regular session, by design — it's a real privilege boundary, not one we
 * can route around with a SECURITY DEFINER function the way role changes
 * were). Returns a clear 501 if the key isn't configured rather than
 * failing in a confusing way.
 */
export async function POST(request: Request) {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          "Inviting users needs SUPABASE_SERVICE_ROLE_KEY configured on the server. Add it to .env.local (Supabase dashboard > Project Settings > API) and restart.",
      },
      { status: 501 },
    );
  }

  const { email, name, role } = await request.json();
  const validRoles: Enums<"user_role">[] = ["admin", "manager", "sales"];

  if (!email || !name || !validRoles.includes(role)) {
    return NextResponse.json({ error: "Email, name, and a valid role are required" }, { status: 400 });
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name },
  });

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Failed to invite user" }, { status: 400 });
  }

  // handle_new_user() already created a profile row with the default role
  // ('sales') — update it to whatever the admin actually chose.
  if (role !== "sales") {
    await admin.from("profiles").update({ role }).eq("id", data.user.id);
  }

  const supabase = await createClient();
  await logAudit(supabase, {
    action: "USER_INVITED",
    entityType: "profile",
    entityId: data.user.id,
    metadata: { email, role },
  });

  return NextResponse.json({ success: true });
}
