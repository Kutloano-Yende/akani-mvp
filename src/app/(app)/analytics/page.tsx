import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { cumulativeSparkline, weeklySums } from "@/lib/trend";
import { getTenantAppearance } from "@/lib/tenant-appearance";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const [
    { data: companyDates },
    { data: prospects },
    { data: usage },
    { chartStyle, layoutStyle },
  ] = await Promise.all([
    supabase.from("companies").select("created_at"),
    supabase
      .from("prospects")
      .select("status, created_at, companies(industry, province)"),
    supabase.from("api_usage").select("created_at, credits_used"),
    getTenantAppearance(supabase),
  ]);

  const businessesFound = (companyDates ?? []).length;
  const businessesFoundSparkline = cumulativeSparkline((companyDates ?? []).map((c) => ({ date: c.created_at })));

  const rows = prospects ?? [];
  const counts: Record<string, number> = {
    identified: 0,
    qualified: 0,
    contacted: 0,
    interested: 0,
    application: 0,
    won: 0,
    lost: 0,
  };
  for (const p of rows) counts[p.status] = (counts[p.status] ?? 0) + 1;

  const totalProspects = rows.length;
  const nonLost = totalProspects - counts.lost;
  const qualifiedOrLater =
    counts.qualified + counts.contacted + counts.interested + counts.application + counts.won;
  const applicationOrLater = counts.application + counts.won;

  const qualificationRate = nonLost > 0 ? (qualifiedOrLater / nonLost) * 100 : 0;
  const applicationRate = nonLost > 0 ? (applicationOrLater / nonLost) * 100 : 0;
  const conversionRate = nonLost > 0 ? (counts.won / nonLost) * 100 : 0;

  const creditsUsed = (usage ?? []).reduce((sum, u) => sum + u.credits_used, 0);
  const creditsSparkline = cumulativeSparkline((usage ?? []).map((u) => ({ date: u.created_at, value: u.credits_used })));

  const byIndustry = tally(rows, (p) => company(p)?.industry);
  const byProvince = tally(rows, (p) => company(p)?.province);

  // Server component: each request is meant to compute "last 30 days" fresh.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const newThisMonth = rows.filter((p) => new Date(p.created_at).getTime() >= thirtyDaysAgo).length;
  // Per-week counts (not cumulative) -- this stat is itself a rolling
  // 30-day window, so the sparkline shows whether sourcing is speeding up
  // or slowing down, not a running total.
  const newProspectsSparkline = weeklySums(rows.map((p) => ({ date: p.created_at })));

  const cs = chartStyle ?? "line";
  const sourcingCards = [
    <StatCard
      key="businesses-discovered"
      label="Businesses discovered"
      value={businessesFound}
      sparkline={businessesFoundSparkline}
      chartStyle={cs}
    />,
    <StatCard
      key="new-prospects"
      label="New prospects (30 days)"
      value={newThisMonth}
      sparkline={newProspectsSparkline}
      chartStyle={cs}
    />,
    <StatCard key="qualified-prospects" label="Qualified prospects" value={qualifiedOrLater} />,
  ];
  const conversionCards = [
    <StatCard key="contacted" label="Contacted" value={counts.contacted} />,
    <StatCard key="interested" label="Interested" value={counts.interested} />,
    <StatCard key="applications" label="Applications" value={applicationOrLater} />,
    <StatCard key="paying-clients" label="Paying clients" value={counts.won} accent />,
  ];
  const performanceCards = [
    <StatCard key="qualification-rate" label="Qualification rate" value={`${qualificationRate.toFixed(0)}%`} />,
    <StatCard key="application-rate" label="Application rate" value={`${applicationRate.toFixed(0)}%`} />,
    <StatCard key="conversion-rate" label="Conversion rate" value={`${conversionRate.toFixed(0)}%`} />,
    <StatCard key="credits-used" label="Credits used" value={creditsUsed} sparkline={creditsSparkline} chartStyle={cs} />,
  ];

  return (
    <div className="space-y-8">
      <p className="text-sm text-akani-text-secondary">Is the system working, and where.</p>

      {layoutStyle === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {sourcingCards}
          {conversionCards}
          {performanceCards}
        </div>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-sm font-semibold text-akani-text-primary">Sourcing</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{sourcingCards}</div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-akani-text-primary">Conversion</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">{conversionCards}</div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-akani-text-primary">Performance</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">{performanceCards}</div>
          </section>
        </>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BreakdownCard title="Prospects by industry" data={byIndustry} />
        <BreakdownCard title="Prospects by province" data={byProvince} />
      </div>
    </div>
  );
}

type ProspectRow = {
  status: string;
  created_at: string;
  companies: { industry: string | null; province: string | null } | { industry: string | null; province: string | null }[] | null;
};

function company(p: ProspectRow) {
  return Array.isArray(p.companies) ? p.companies[0] : p.companies;
}

function tally(rows: ProspectRow[], key: (p: ProspectRow) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = key(row) || "Unknown";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function BreakdownCard({ title, data }: { title: string; data: [string, number][] }) {
  const max = Math.max(...data.map(([, count]) => count), 1);
  return (
    <div className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-akani-text-primary">{title}</h2>
      <div className="space-y-2">
        {data.slice(0, 8).map(([label, count]) => (
          <div key={label} className="flex items-center gap-3">
            <div className="w-32 shrink-0 truncate text-xs font-medium text-akani-text-secondary">
              {label}
            </div>
            <div className="h-5 flex-1 rounded bg-akani-page-bg">
              <div
                className="h-5 rounded bg-akani-deep-blue"
                style={{ width: `${Math.max((count / max) * 100, 4)}%` }}
              />
            </div>
            <div className="w-6 shrink-0 text-right text-xs font-semibold text-akani-text-primary">
              {count}
            </div>
          </div>
        ))}
        {data.length === 0 && <p className="text-sm text-akani-text-muted">No data yet.</p>}
      </div>
    </div>
  );
}
