import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
// The generic StatusBadge, not TenderStatusBadge -- this column is the
// TENANT's own pipeline state (saved/in_progress/submitted/won/lost/
// archived), which shares "won"/"lost" semantics with prospect_status, not
// the OCDS tender.status vocabulary TenderStatusBadge's color map is for.
import { StatusBadge } from "@/components/status-badge";

export default async function SavedTendersPage() {
  const supabase = await createClient();

  // No tenant_id filter -- RLS's "saved_tenders readable within tenant"
  // policy is the real scoping (same convention as every other tenant-scoped
  // list page in this app).
  const { data: saved } = await supabase
    .from("saved_tenders")
    .select("id, status, notes, created_at, assigned_to, tenders(id, title, status, buyer_name, tender_period_end), profiles(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <p className="text-sm text-akani-text-secondary">Tenders your team has saved for follow-up.</p>

      <div className="overflow-hidden rounded-xl border border-akani-card-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-akani-card-border text-left text-xs uppercase tracking-wide text-akani-text-muted">
                <th className="px-4 py-3 font-medium sm:px-6">Tender</th>
                <th className="hidden px-4 py-3 font-medium sm:px-6 md:table-cell">Buyer</th>
                <th className="px-4 py-3 font-medium sm:px-6">Our status</th>
                <th className="hidden px-4 py-3 font-medium sm:px-6 lg:table-cell">Assigned</th>
                <th className="hidden px-4 py-3 font-medium sm:px-6 lg:table-cell">Closing</th>
              </tr>
            </thead>
            <tbody>
              {(saved ?? []).map((s) => {
                const tender = Array.isArray(s.tenders) ? s.tenders[0] : s.tenders;
                const assignee = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
                if (!tender) return null;
                return (
                  <tr key={s.id} className="border-b border-akani-card-border last:border-0 hover:bg-akani-page-bg">
                    <td className="px-4 py-3 sm:px-6">
                      <Link href={`/tenders/${tender.id}`} className="font-medium text-akani-text-primary hover:text-akani-gold">
                        {tender.title}
                      </Link>
                      <span className="block text-xs text-akani-text-muted md:hidden">{tender.buyer_name ?? "—"}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-akani-text-secondary sm:px-6 md:table-cell">
                      {tender.buyer_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="hidden px-4 py-3 text-akani-text-secondary sm:px-6 lg:table-cell">
                      {assignee?.name ?? "Unassigned"}
                    </td>
                    <td className="hidden px-4 py-3 text-akani-text-muted sm:px-6 lg:table-cell">
                      {tender.tender_period_end ? new Date(tender.tender_period_end).toLocaleDateString("en-ZA") : "—"}
                    </td>
                  </tr>
                );
              })}
              {(saved ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-akani-text-muted">
                    No saved tenders yet. Save one from{" "}
                    <Link href="/tenders" className="font-medium text-akani-gold hover:underline">
                      Opportunities
                    </Link>
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
