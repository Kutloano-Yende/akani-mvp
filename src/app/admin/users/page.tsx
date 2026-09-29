import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function SuperAdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const { tenant: tenantFilter } = await searchParams;
  const supabase = await createClient();

  const [{ data: tenants }, usersQuery] = await Promise.all([
    supabase.from("tenants").select("id, name").order("name"),
    (async () => {
      let query = supabase
        .from("profiles")
        .select("id, name, role, created_at, tenant_id, tenants(name)")
        .order("created_at", { ascending: false });
      if (tenantFilter) query = query.eq("tenant_id", tenantFilter);
      return query;
    })(),
  ]);
  const { data: users } = usersQuery;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="mb-1 text-sm font-semibold text-slate-900">All users</h2>
            <p className="text-sm text-slate-600">Every user across every tenant. Read-only here.</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-sm">
            <Link
              href="/admin/users"
              className={`rounded-md px-3 py-1 font-medium ${
                !tenantFilter ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
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
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50"
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
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Tenant</th>
                <th className="py-2 font-medium">Role</th>
                <th className="py-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => {
                const tenant = Array.isArray(u.tenants) ? u.tenants[0] : u.tenants;
                return (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 font-medium text-slate-900">{u.name}</td>
                    <td className="py-3 text-slate-600">{tenant?.name ?? "—"}</td>
                    <td className="py-3 capitalize text-slate-600">{u.role}</td>
                    <td className="py-3 text-slate-500">{new Date(u.created_at).toLocaleDateString("en-ZA")}</td>
                  </tr>
                );
              })}
              {(users ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
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
