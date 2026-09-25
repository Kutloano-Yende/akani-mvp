import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { getCurrentUser } from "@/lib/auth/current-user";
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
  searchParams: Promise<{ status?: string; mine?: string }>;
}) {
  const { status, mine } = await searchParams;
  const activeTab = status ?? "all";
  const onlyMine = mine === "1";
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  function hrefFor(tab: string, mineFlag: boolean) {
    const qs = new URLSearchParams();
    if (tab !== "all") qs.set("status", tab);
    if (mineFlag) qs.set("mine", "1");
    const str = qs.toString();
    return str ? `/prospects?${str}` : "/prospects";
  }

  let query = supabase
    .from("prospects")
    .select(
      "id, status, opportunity_score, created_at, last_contacted_at, companies(name, industry, province), profiles(name)",
    )
    .order("created_at", { ascending: false });

  if (activeTab !== "all") {
    query = query.eq("status", activeTab as Enums<"prospect_status">);
  }

  if (onlyMine && currentUser) {
    query = query.eq("assigned_to", currentUser.id);
  }

  const { data: prospects } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-akani-text-secondary">The working prospect database.</p>
        <div data-tour="prospects-toolbar" className="flex items-center gap-3">
        <a
          href={`/api/export/prospects${(() => {
            const qs = new URLSearchParams();
            if (activeTab !== "all") qs.set("status", activeTab);
            if (onlyMine) qs.set("mine", "1");
            return qs.size ? `?${qs}` : "";
          })()}`}
          className="rounded-md border border-akani-card-border bg-white px-3 py-1.5 text-sm font-medium text-akani-text-primary hover:bg-akani-page-bg"
        >
          Export CSV
        </a>
        <div className="inline-flex rounded-md border border-akani-card-border bg-white p-0.5 text-sm">
          <Link
            href={hrefFor(activeTab, false)}
            className={`rounded px-3 py-1 font-medium ${
              !onlyMine ? "bg-akani-navy text-white" : "text-akani-text-secondary hover:text-akani-text-primary"
            }`}
          >
            All
          </Link>
          <Link
            href={hrefFor(activeTab, true)}
            className={`rounded px-3 py-1 font-medium ${
              onlyMine ? "bg-akani-navy text-white" : "text-akani-text-secondary hover:text-akani-text-primary"
            }`}
          >
            Mine
          </Link>
        </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-akani-card-border">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={hrefFor(tab.key, onlyMine)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              activeTab === tab.key
                ? "border-akani-gold text-akani-gold"
                : "border-transparent text-akani-text-secondary hover:text-akani-text-primary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-akani-card-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-akani-card-border text-left text-xs uppercase tracking-wide text-akani-text-muted">
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
                <tr key={p.id} className="border-b border-akani-card-border last:border-0 hover:bg-akani-page-bg">
                  <td className="px-6 py-3">
                    <Link href={`/prospects/${p.id}`} className="font-medium text-akani-text-primary hover:text-akani-gold">
                      {company?.name ?? "Unknown"}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-akani-text-secondary">{company?.industry ?? "—"}</td>
                  <td className="px-6 py-3 text-akani-text-secondary">{company?.province ?? "—"}</td>
                  <td className="px-6 py-3 text-akani-text-secondary">{p.opportunity_score ?? "—"}</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-6 py-3 text-akani-text-secondary">{assignee?.name ?? "Unassigned"}</td>
                  <td className="px-6 py-3 text-akani-text-muted">
                    {p.last_contacted_at
                      ? new Date(p.last_contacted_at).toLocaleDateString("en-ZA")
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {(prospects ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-akani-text-muted">
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
