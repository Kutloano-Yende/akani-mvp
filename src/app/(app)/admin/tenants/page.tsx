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
  allowCustomBranding: boolean;
};

export default async function TenantsPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, slug, status, created_at, allow_custom_branding")
    .order("created_at", { ascending: false });

  const rows: TenantRow[] = await Promise.all(
    (tenants ?? []).map(async (t) => {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", t.id);
      return {
        ...t,
        status: t.status as "active" | "suspended",
        userCount: count ?? 0,
        allowCustomBranding: t.allow_custom_branding,
      };
    }),
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">Create a tenant</h2>
        <p className="mb-4 text-sm text-akani-text-secondary">
          Creates the tenant and sends its first admin an invite in one step.
        </p>
        <CreateTenantForm />
      </section>

      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-akani-text-primary">All tenants</h2>
        <TenantList tenants={rows} />
      </section>
    </div>
  );
}
