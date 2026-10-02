import { cookies } from "next/headers";

export const IMPERSONATION_COOKIE = "impersonation_id";
export const IMPERSONATION_MAX_AGE_SECONDS = 60 * 60; // auto-expires rather than staying open indefinitely.

export type ActiveImpersonation = {
  sessionId: string;
  targetName: string;
  tenantName: string | null;
  startedAt: string;
};

// Server Components only need "is this session impersonating, and who" to
// render the banner -- the service-role lookup is the only way to answer
// that, since the impersonated user has no read policy on this table.
export async function getActiveImpersonation(): Promise<ActiveImpersonation | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (!sessionId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: session } = await admin
    .from("impersonation_sessions")
    .select("started_at, ended_at, target_user_id")
    .eq("id", sessionId)
    .single();
  if (!session || session.ended_at) return null;

  const { data: target } = await admin.from("profiles").select("name, tenants(name)").eq("id", session.target_user_id).single();
  if (!target) return null;
  const tenant = Array.isArray(target.tenants) ? target.tenants[0] : target.tenants;

  return { sessionId, targetName: target.name, tenantName: tenant?.name ?? null, startedAt: session.started_at };
}
