import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";

const FUNNEL_STAGES = [
  { key: "identified", label: "Businesses Found" },
  { key: "qualified", label: "Qualified" },
  { key: "contacted", label: "Contacted" },
  { key: "interested", label: "Interested" },
  { key: "application", label: "Application" },
  { key: "won", label: "Paying Client" },
] as const;

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: businessesFound }, { data: prospects }, { data: recent }] =
    await Promise.all([
      supabase.from("companies").select("*", { count: "exact", head: true }),
      supabase.from("prospects").select("status"),
      supabase
        .from("prospects")
        .select("id, status, created_at, opportunity_score, companies(name, industry, province)")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const counts: Record<string, number> = {
    identified: 0,
    qualified: 0,
    contacted: 0,
    interested: 0,
    application: 0,
    won: 0,
    lost: 0,
  };
  for (const p of prospects ?? []) counts[p.status] = (counts[p.status] ?? 0) + 1;

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
  for (const p of prospects ?? []) {
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Is this system actually finding us business?</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Businesses Found" value={businessesFound ?? 0} />
        <StatCard label="Qualified Prospects" value={qualifiedProspects} />
        <StatCard label="Applications" value={applications} />
        <StatCard label="Paying Clients" value={payingClients} accent />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Funnel</h2>
        <div className="space-y-2">
          {FUNNEL_STAGES.map((stage) => {
            const value = cumulative[stage.key] ?? 0;
            const pct = Math.max((value / maxFunnel) * 100, value > 0 ? 4 : 0);
            return (
              <div key={stage.key} className="flex items-center gap-3">
                <div className="w-32 shrink-0 text-xs font-medium text-slate-600">{stage.label}</div>
                <div className="h-6 flex-1 rounded bg-slate-100">
                  <div
                    className="h-6 rounded bg-emerald-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="w-10 shrink-0 text-right text-xs font-semibold text-slate-700">
                  {value}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Recent prospects</h2>
          <Link href="/prospects" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
            View all
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-6 py-3 font-medium">Company</th>
              <th className="px-6 py-3 font-medium">Industry</th>
              <th className="px-6 py-3 font-medium">Province</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {(recent ?? []).map((p) => {
              const company = Array.isArray(p.companies) ? p.companies[0] : p.companies;
              return (
                <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <Link href={`/prospects/${p.id}`} className="font-medium text-slate-900 hover:text-emerald-700">
                      {company?.name ?? "Unknown"}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-slate-600">{company?.industry ?? "—"}</td>
                  <td className="px-6 py-3 text-slate-600">{company?.province ?? "—"}</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-6 py-3 text-slate-600">{p.opportunity_score ?? "—"}</td>
                </tr>
              );
            })}
            {(recent ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                  No prospects yet.{" "}
                  <Link href="/prospects/discover" className="text-emerald-700 hover:underline">
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

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent ? "text-emerald-600" : "text-slate-900"}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
