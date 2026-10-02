import { headers, cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  const h = await headers();
  const origin = h.get("origin") ?? new URL(request.url).origin;

  if (!sessionId || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    cookieStore.delete(IMPERSONATION_COOKIE);
    return NextResponse.json({ ok: true, redirect: `${origin}/login` });
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: session } = await admin
    .from("impersonation_sessions")
    .select("admin_id, ended_at")
    .eq("id", sessionId)
    .single();

  if (!session || session.ended_at) {
    cookieStore.delete(IMPERSONATION_COOKIE);
    return NextResponse.json({ ok: true, redirect: `${origin}/login` });
  }

  await admin.from("impersonation_sessions").update({ ended_at: new Date().toISOString() }).eq("id", sessionId);

  // Not logAudit(): the *current* session here is still the target user, and
  // logAudit's trigger would attribute this to them, not the admin. A
  // service-role insert has no session for that trigger to key off, so the
  // explicit user_id sticks.
  await admin.from("audit_logs").insert({
    action: "IMPERSONATION_ENDED",
    entity_type: "user",
    user_id: session.admin_id,
  });

  const { data: adminAuthUser, error: adminAuthError } = await admin.auth.admin.getUserById(session.admin_id);
  if (adminAuthError || !adminAuthUser.user?.email) {
    cookieStore.delete(IMPERSONATION_COOKIE);
    return NextResponse.json({ ok: true, redirect: `${origin}/login` });
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: adminAuthUser.user.email,
  });

  const supabase = await createClient();
  cookieStore.delete(IMPERSONATION_COOKIE);

  if (linkError || !link?.properties?.hashed_token) {
    // Can't restore the admin's own session -- sign out of the target's
    // session entirely rather than leave the browser impersonating with no
    // way back and no banner.
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true, redirect: `${origin}/login` });
  }

  await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  return NextResponse.json({ ok: true, redirect: `${origin}/admin/users` });
}
