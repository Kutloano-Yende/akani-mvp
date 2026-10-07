/**
 * profiles has no email column -- it lives in auth.users, which only the
 * service-role admin client can read. Shared by every page that lists
 * users and wants to show their email alongside the profile data.
 */
export async function fetchUserEmails(): Promise<Map<string, string>> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return new Map();

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error || !data) return new Map();

  return new Map(data.users.map((u) => [u.id, u.email ?? ""]));
}
