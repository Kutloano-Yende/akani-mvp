import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import type { Enums } from "@/types/database";

const TABS = [
  { key: "all", label: "All" },
  { key: "qualified", label: "Qualified" },
  { key: "contacted", label: "Contacted" },
  { key: "interested", label: "Interested" },
  { key: "application", label: "Application" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
] as const;

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeTab = status ?? "all";
  const supabase = await createClient();

  let query = supabase
    .from("prospects")
    .select(
      "id, status, opportunity_score, created_at, last_contacted_at, companies(name, industry, province), profiles(name)",
    )
    .order("created_at", { ascending: false });

  if (activeTab !== "all") {
    query = query.eq("status", activeTab as Enums<"prospect_status">);
  }

  const { data: prospects } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Prospects</h1>
        <p className="mt-1 text-sm text-slate-500">The working prospect database.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/prospects" : `/prospects?status=${tab.key}`}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              activeTab === tab.key
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-6 py-3 font-medium">Company</th>
              <th className="px-6 py-3 font-medium">Industry</th>
              <th className="px-6 py-3 font-medium">Province</th>
              <th className="px-6 py-3 font-medium">Opportunity</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Assigned</th>
              <th className="px-6 py-3 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {(prospects ?? []).map((p) => {
              const company = Array.isArray(p.companies) ? p.companies[0] : p.companies;
              const assignee = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
              return (
                <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <Link href={`/prospects/${p.id}`} className="font-medium text-slate-900 hover:text-emerald-700">
                      {company?.name ?? "Unknown"}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-slate-600">{company?.industry ?? "—"}</td>
                  <td className="px-6 py-3 text-slate-600">{company?.province ?? "—"}</td>
                  <td className="px-6 py-3 text-slate-600">{p.opportunity_score ?? "—"}</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-6 py-3 text-slate-600">{assignee?.name ?? "Unassigned"}</td>
                  <td className="px-6 py-3 text-slate-500">
                    {p.last_contacted_at
                      ? new Date(p.last_contacted_at).toLocaleDateString("en-ZA")
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {(prospects ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                  No prospects in this stage yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
