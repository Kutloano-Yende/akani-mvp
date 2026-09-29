import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";

export default async function SuperAdminOverviewPage() {
  const supabase = await createClient();

  const [
    { count: activeTenants },
    { count: suspendedTenants },
    { count: users },
    { count: companies },
    { count: prospects },
    { count: campaigns },
  ] = await Promise.all([
    supabase.from("tenants").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("tenants").select("*", { count: "exact", head: true }).eq("status", "suspended"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("companies").select("*", { count: "exact", head: true }),
    supabase.from("prospects").select("*", { count: "exact", head: true }),
    supabase.from("campaigns").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">Platform-wide totals across every tenant.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Tenants"
          value={(activeTenants ?? 0) + (suspendedTenants ?? 0)}
          supportingText={`${activeTenants ?? 0} active, ${suspendedTenants ?? 0} suspended`}
        />
        <StatCard label="Users" value={users ?? 0} />
        <StatCard label="Companies" value={companies ?? 0} />
        <StatCard label="Prospects" value={prospects ?? 0} />
        <StatCard label="Campaigns" value={campaigns ?? 0} />
      </div>
    </div>
  );
}
