import { createClient } from "@/lib/supabase/server";
import { CreateTenantForm } from "./create-tenant-form";
import { TenantList } from "./tenant-list";

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  created_at: string;
  userCount: number;
};

export default async function TenantsPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, slug, status, created_at")
    .order("created_at", { ascending: false });

  const rows: TenantRow[] = await Promise.all(
    (tenants ?? []).map(async (t) => {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", t.id);
      return { ...t, status: t.status as "active" | "suspended", userCount: count ?? 0 };
    }),
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Create a tenant</h2>
        <p className="mb-4 text-sm text-slate-600">
          Creates the tenant and sends its first admin an invite in one step.
        </p>
        <CreateTenantForm />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">All tenants</h2>
        <TenantList tenants={rows} />
      </section>
    </div>
  );
}
