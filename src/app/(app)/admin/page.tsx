import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { cumulativeSparkline } from "@/lib/trend";
import { getTenantAppearance } from "@/lib/tenant-appearance";

export default async function SuperAdminOverviewPage() {
  const supabase = await createClient();

  const [
    { count: activeTenants },
    { count: suspendedTenants },
    { data: tenantDates },
    { data: userDates },
    { data: companyDates },
    { data: prospectDates },
    { data: campaignDates },
    { chartStyle },
  ] = await Promise.all([
    supabase.from("tenants").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("tenants").select("*", { count: "exact", head: true }).eq("status", "suspended"),
    supabase.from("tenants").select("created_at"),
    supabase.from("profiles").select("created_at"),
    supabase.from("companies").select("created_at"),
    supabase.from("prospects").select("created_at"),
    supabase.from("campaigns").select("created_at"),
    getTenantAppearance(supabase),
  ]);
  const cs = chartStyle ?? "line";

  const dates = (rows: { created_at: string }[] | null) => (rows ?? []).map((r) => ({ date: r.created_at }));

  return (
    <div className="space-y-6">
      <p className="text-sm text-akani-text-secondary">Platform-wide totals across every tenant.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Tenants"
          value={(activeTenants ?? 0) + (suspendedTenants ?? 0)}
          supportingText={`${activeTenants ?? 0} active, ${suspendedTenants ?? 0} suspended`}
          sparkline={cumulativeSparkline(dates(tenantDates))}
          chartStyle={cs}
        />
        <StatCard
          label="Users"
          value={(userDates ?? []).length}
          sparkline={cumulativeSparkline(dates(userDates))}
          chartStyle={cs}
        />
        <StatCard
          label="Companies"
          value={(companyDates ?? []).length}
          sparkline={cumulativeSparkline(dates(companyDates))}
          chartStyle={cs}
        />
        <StatCard
          label="Prospects"
          value={(prospectDates ?? []).length}
          sparkline={cumulativeSparkline(dates(prospectDates))}
          chartStyle={cs}
        />
        <StatCard
          label="Campaigns"
          value={(campaignDates ?? []).length}
          sparkline={cumulativeSparkline(dates(campaignDates))}
          chartStyle={cs}
        />
      </div>
    </div>
  );
}
