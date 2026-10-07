import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchUserEmails } from "@/lib/auth/user-emails";
import { ImpersonateButton } from "./impersonate-button";
import { UserStatusActions } from "./user-status-actions";

export default async function SuperAdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const { tenant: tenantFilter } = await searchParams;
  const supabase = await createClient();

  const [{ data: tenants }, usersQuery, { data: platformAdmins }, { data: userData }, emailsByUserId] =
    await Promise.all([
      supabase.from("tenants").select("id, name").order("name"),
      (async () => {
        let query = supabase
          .from("profiles")
          .select("id, name, role, status, created_at, tenant_id, tenants(name)")
          .order("created_at", { ascending: false });
        if (tenantFilter) query = query.eq("tenant_id", tenantFilter);
        return query;
      })(),
      supabase.from("platform_admins").select("user_id"),
      supabase.auth.getUser(),
      fetchUserEmails(),
    ]);
  const { data: users } = usersQuery;
  const platformAdminIds = new Set((platformAdmins ?? []).map((p) => p.user_id));
  const platformAdminCount = platformAdminIds.size;
  const currentUserId = userData.user?.id;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">All users</h2>
            <p className="text-sm text-akani-text-secondary">
              Every user across every tenant. Impersonate a regular user to see and act exactly as they would.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-sm">
            <Link
              href="/admin/users"
              className={`rounded-md px-3 py-1 font-medium ${
                !tenantFilter
                  ? "bg-akani-navy text-white"
                  : "border border-akani-card-border text-akani-text-primary hover:bg-akani-page-bg"
              }`}
            >
              All
            </Link>
            {(tenants ?? []).map((t) => (
              <Link
                key={t.id}
                href={`/admin/users?tenant=${t.id}`}
                className={`rounded-md px-3 py-1 font-medium ${
                  tenantFilter === t.id
                    ? "bg-akani-navy text-white"
                    : "border border-akani-card-border text-akani-text-primary hover:bg-akani-page-bg"
                }`}
              >
                {t.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-akani-card-border text-akani-text-muted">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Email</th>
                <th className="py-2 font-medium">Tenant</th>
                <th className="py-2 font-medium">Role</th>
                <th className="py-2 font-medium">Joined</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => {
                const tenant = Array.isArray(u.tenants) ? u.tenants[0] : u.tenants;
                const isPlatformAdmin = platformAdminIds.has(u.id);
                const isSelf = u.id === currentUserId;
                const isLastPlatformAdmin = isPlatformAdmin && platformAdminCount <= 1;
                const disabledReason = isSelf
                  ? "You can't do this to your own account"
                  : isLastPlatformAdmin
                    ? "This is the last remaining platform admin"
                    : undefined;
                return (
                  <tr key={u.id} className="border-b border-akani-card-border last:border-0">
                    <td className="py-3 font-medium text-akani-text-primary">
                      {u.name}
                      {isPlatformAdmin && (
                        <span className="ml-2 rounded-full bg-akani-gold/15 px-2 py-0.5 text-xs font-semibold text-akani-gold">
                          Super Admin
                        </span>
                      )}
                      {u.status === "suspended" && (
                        <span className="ml-2 rounded-full bg-akani-error-bg px-2 py-0.5 text-xs font-semibold text-akani-error">
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-akani-text-secondary">{emailsByUserId.get(u.id) || "—"}</td>
                    <td className="py-3 text-akani-text-secondary">
                      {tenant?.name ?? "—"}
                      {isPlatformAdmin && <span className="text-akani-text-muted"> (also platform-wide)</span>}
                    </td>
                    <td className="py-3 capitalize text-akani-text-secondary">{u.role}</td>
                    <td className="py-3 text-akani-text-muted">{new Date(u.created_at).toLocaleDateString("en-ZA")}</td>
                    <td className="py-3">
                      <div className="flex flex-col items-end gap-1.5">
                        {!isPlatformAdmin && <ImpersonateButton userId={u.id} name={u.name} />}
                        <UserStatusActions
                          userId={u.id}
                          name={u.name}
                          status={u.status === "suspended" ? "suspended" : "active"}
                          disabledReason={disabledReason}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(users ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-akani-text-muted">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
