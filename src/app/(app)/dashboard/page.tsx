import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { SalesChart } from "@/components/sales-chart";
import { SalesInsightCard, type SalesInsight } from "@/components/sales-insight-card";

const FUNNEL_STAGES = [
  { key: "identified", label: "Businesses Found" },
  { key: "qualified", label: "Qualified" },
  { key: "contacted", label: "Contacted" },
  { key: "interested", label: "Interested" },
  { key: "application", label: "Application" },
  { key: "won", label: "Paying Client" },
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: businessesFound }, { data: prospects }] = await Promise.all([
    supabase.from("companies").select("*", { count: "exact", head: true }),
    supabase
      .from("prospects")
      .select("id, status, created_at, last_contacted_at, opportunity_score, companies(name, industry, province)")
      .order("created_at", { ascending: false }),
  ]);

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

  // Funnel is cumulative: a prospect at stage N passed through every earlier
  // stage too. Every prospect — lost ones included — was at least
  // "identified", so lost prospects still count there; we don't track which
  // later stage they dropped out of, so they're not counted beyond that.
  const order: (keyof typeof counts)[] = [
    "identified",
    "qualified",
    "contacted",
    "interested",
    "application",
    "won",
  ];
  const cumulative: Record<string, number> = Object.fromEntries(order.map((s) => [s, 0]));
  for (const p of rows) {
    if (p.status === "lost") {
      cumulative.identified += 1;
      continue;
    }
    const stageIndex = order.indexOf(p.status as (typeof order)[number]);
    for (let i = 0; i <= stageIndex; i++) cumulative[order[i]] += 1;
  }

  const qualifiedProspects =
    counts.qualified + counts.contacted + counts.interested + counts.application + counts.won;
  const applications = counts.application + counts.won;
  const payingClients = counts.won;
  const maxFunnel = cumulative[order[0]] || 1;

  // eslint-disable-next-line react-hooks/purity -- server component; "this week" is meant to be computed fresh per request
  const now = Date.now();
  const newThisWeek = rows.filter((p) => now - new Date(p.created_at).getTime() < 7 * DAY_MS).length;

  // Real weekly bucket for the last 8 weeks, oldest first.
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const weeksAgo = 7 - i;
    const start = now - (weeksAgo + 1) * 7 * DAY_MS;
    const end = now - weeksAgo * 7 * DAY_MS;
    const value = rows.filter((p) => {
      const t = new Date(p.created_at).getTime();
      return t >= start && t < end;
    }).length;
    const label = weeksAgo === 0 ? "This wk" : `-${weeksAgo}w`;
    return { label, value };
  });

  // Real computed insights — no fabricated copy.
  const needsFollowUp = rows.filter(
    (p) =>
      ["qualified", "contacted", "interested"].includes(p.status) &&
      (!p.last_contacted_at || now - new Date(p.last_contacted_at).getTime() > 7 * DAY_MS),
  );
  const topUnqualified = rows
    .filter((p) => p.status === "identified" && p.opportunity_score !== null)
    .sort((a, b) => (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0))[0];
  const topUnqualifiedCompany = topUnqualified
    ? Array.isArray(topUnqualified.companies)
      ? topUnqualified.companies[0]
      : topUnqualified.companies
    : null;

  const insights: SalesInsight[] = [];
  if (needsFollowUp.length > 0) {
    insights.push({
      text: `${needsFollowUp.length} prospect${needsFollowUp.length === 1 ? "" : "s"} in active stages ${
        needsFollowUp.length === 1 ? "hasn't" : "haven't"
      } been contacted in 7+ days.`,
      tone: "warning",
    });
  }
  if (topUnqualifiedCompany) {
    insights.push({
      text: `${topUnqualifiedCompany.name} (score ${topUnqualified.opportunity_score}) is your highest-scoring unqualified prospect — worth a look.`,
      tone: "action",
    });
  }
  if (counts.application > 0) {
    insights.push({
      text: `${counts.application} application${counts.application === 1 ? "" : "s"} currently in progress.`,
      tone: "action",
    });
  }
  if (payingClients > 0) {
    insights.push({
      text: `${payingClients} prospect${payingClients === 1 ? "" : "s"} converted to a paying client so far.`,
      tone: "positive",
    });
  }

  const recent = rows.slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-akani-text-secondary">Is this system actually finding us business?</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Businesses Found"
          value={businessesFound ?? 0}
          supportingText={newThisWeek > 0 ? `+${newThisWeek} this week` : "No new activity this week"}
        />
        <StatCard label="Qualified Prospects" value={qualifiedProspects} />
        <StatCard label="Applications" value={applications} />
        <StatCard label="Paying Clients" value={payingClients} accent />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-akani-text-primary">New prospects per week</h2>
          <SalesChart data={weeks} />
        </div>
        <SalesInsightCard insights={insights} />
      </div>

      <div className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-akani-text-primary">Pipeline funnel</h2>
        <div className="space-y-2">
          {FUNNEL_STAGES.map((stage) => {
            const value = cumulative[stage.key] ?? 0;
            const pct = Math.max((value / maxFunnel) * 100, value > 0 ? 4 : 0);
            const isFinal = stage.key === "won";
            return (
              <div key={stage.key} className="flex items-center gap-3">
                <div className="w-32 shrink-0 text-xs font-medium text-akani-text-secondary">
                  {stage.label}
                </div>
                <div className="h-6 flex-1 rounded bg-akani-page-bg">
                  <div
                    className={`h-6 rounded transition-all ${isFinal ? "bg-akani-gold" : "bg-akani-deep-blue"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="w-10 shrink-0 text-right text-xs font-semibold text-akani-text-primary">
                  {value}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-akani-card-border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-akani-card-border px-6 py-4">
          <h2 className="text-sm font-semibold text-akani-text-primary">Recent prospects</h2>
          <Link href="/prospects" className="text-sm font-medium text-akani-gold hover:text-akani-gold-bright">
            View all
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-akani-card-border text-left text-xs uppercase tracking-wide text-akani-text-muted">
              <th className="px-6 py-3 font-medium">Company</th>
              <th className="px-6 py-3 font-medium">Industry</th>
              <th className="px-6 py-3 font-medium">Province</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((p) => {
              const company = Array.isArray(p.companies) ? p.companies[0] : p.companies;
              return (
                <tr key={p.id} className="border-b border-akani-card-border last:border-0 hover:bg-akani-page-bg">
                  <td className="px-6 py-3">
                    <Link
                      href={`/prospects/${p.id}`}
                      className="font-medium text-akani-text-primary hover:text-akani-gold"
                    >
                      {company?.name ?? "Unknown"}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-akani-text-secondary">{company?.industry ?? "—"}</td>
                  <td className="px-6 py-3 text-akani-text-secondary">{company?.province ?? "—"}</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-6 py-3 text-akani-text-secondary">{p.opportunity_score ?? "—"}</td>
                </tr>
              );
            })}
            {recent.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-akani-text-muted">
                  No prospects yet.{" "}
                  <Link href="/prospects/discover" className="text-akani-gold hover:underline">
                    Find businesses
                  </Link>{" "}
                  to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
