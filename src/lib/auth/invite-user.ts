import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppUrl } from "@/lib/email/provider";
import type { Database } from "@/types/database";

/**
 * Shared by the tenant-scoped invite route and the Super Admin "create
 * tenant" flow — the only difference between them is which tenant_id gets
 * baked into the invite metadata for handle_new_user() to pick up. Never
 * let the tenant_id come from client input; both callers resolve it
 * server-side (current_tenant_id() for a normal invite, the just-created
 * tenant's id for a new tenant's first admin).
 */
export async function inviteUser(
  admin: SupabaseClient<Database>,
  params: { email: string; name: string; tenantId: string; originHeader: string | null; hostHeader: string | null },
) {
  const appUrl = getAppUrl(params.originHeader ?? (params.hostHeader ? `https://${params.hostHeader}` : "http://localhost:3000"));

  return admin.auth.admin.inviteUserByEmail(params.email, {
    data: { name: params.name, tenant_id: params.tenantId },
    // Same shape as the password-reset flow (requestPasswordReset in
    // login/actions.ts): an invited user needs to set a password before
    // they have anything to sign in with, so send them to the same page.
    redirectTo: `${appUrl}/auth/callback?next=/auth/update-password`,
  });
}
