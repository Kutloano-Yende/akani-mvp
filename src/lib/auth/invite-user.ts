import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAppUrl, sendEmail, sendingUnavailable } from "@/lib/email/provider";
import { buildInviteEmail } from "./invite-email";
import type { Database } from "@/types/database";

/**
 * Shared by the tenant-scoped invite route and the Super Admin "create
 * tenant" flow — the only difference between them is which tenant_id gets
 * baked into the invite metadata for handle_new_user() to pick up. Never
 * let the tenant_id come from client input; both callers resolve it
 * server-side (current_tenant_id() for a normal invite, the just-created
 * tenant's id for a new tenant's first admin).
 *
 * Sends the invite itself through Akani's own branded email pipeline
 * rather than Supabase's built-in invite email: generateLink() creates the
 * user and returns the same action_link Supabase's own email would have
 * used, without Supabase sending anything — so this is the only invite
 * email a new user gets, and it looks like every other Akani email.
 */
export async function inviteUser(
  admin: SupabaseClient<Database>,
  params: { email: string; name: string; tenantId: string; originHeader: string | null; hostHeader: string | null },
): Promise<{ data: { user: User | null }; error: { message: string } | null }> {
  const appUrl = getAppUrl(params.originHeader ?? (params.hostHeader ? `https://${params.hostHeader}` : "http://localhost:3000"));

  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: params.email,
    options: {
      data: { name: params.name, tenant_id: params.tenantId },
      // Straight to the page, not via /auth/callback: this is an admin-minted
      // link, so GoTrue can only hand back the session as a URL *hash*
      // fragment (no PKCE verifier exists for a `code` exchange) -- the
      // callback route's server-side exchangeCodeForSession can't do
      // anything with that. /auth/update-password reads the hash itself.
      redirectTo: `${appUrl}/auth/update-password`,
    },
  });
  if (error) return { data: { user: null }, error: { message: error.message } };
  if (!data?.properties?.action_link) {
    return { data: { user: data?.user ?? null }, error: { message: "No invite link returned" } };
  }

  if (sendingUnavailable()) {
    return { data: { user: data.user }, error: { message: "Email sending isn't configured on the server; the invite link wasn't sent." } };
  }

  const email = buildInviteEmail(params.name, data.properties.action_link, appUrl);
  const result = await sendEmail({ to: params.email, subject: email.subject, html: email.html, text: email.text });
  if (!result.ok) return { data: { user: data.user }, error: { message: result.error } };

  return { data: { user: data.user }, error: null };
}
