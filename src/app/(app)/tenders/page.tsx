import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TenderStatusBadge, ProvinceBadge } from "@/components/tender-status-badge";
import { TenderFilters } from "./tender-filters";
import { SaveTenderButton } from "./save-tender-button";

const PAGE_SIZE = 25;

/** The select string varies with `hasAward` (a runtime value, not a
 * literal), so the generated client can't narrow `tender_awards` into the
 * row type on its own -- cast explicitly instead, same pattern already used
 * elsewhere in this module for data shaped from a dynamic query. */
type TenderRow = {
  id: string;
  title: string;
  status: string;
  main_procurement_category: string | null;
  buyer_name: string | null;
  province_guess: string | null;
  tender_period_end: string | null;
  source_url: string | null;
  tender_awards?: { supplier_name: string; value_amount: number | null; value_currency: string | null }[];
};

const zarFormatter = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 });

export default async function TendersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const province = sp.province ?? "";
  const category = sp.category ?? "";
  const status = sp.status ?? "";
  const closingBefore = sp.closingBefore ?? "";
  const closingAfter = sp.closingAfter ?? "";
  const hasAward = sp.hasAward === "true";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();

  // hasAward=true inner-joins tender_awards and sorts by real award value --
  // see src/app/api/tenders/route.ts for why this can't be a status filter
  // (award data isn't correlated with tender.status) and why the contact
  // info on the OCDS "supplier" party is never surfaced here.
  let query = supabase
    .from("tenders")
    .select(
      hasAward
        ? "id, title, status, main_procurement_category, buyer_name, province_guess, tender_period_end, source_url, tender_awards!inner(supplier_name, value_amount, value_currency)"
        : "id, title, status, main_procurement_category, buyer_name, province_guess, tender_period_end, source_url",
      { count: "exact" },
    );

  if (hasAward) {
    query = query.order("value_amount", { foreignTable: "tender_awards", ascending: false, nullsFirst: false });
  } else {
    query = query.order("tender_period_end", { ascending: true, nullsFirst: false });
  }

  if (q) query = query.textSearch("search_vector", q, { type: "websearch" });
  if (province) query = query.eq("province_guess", province);
  if (category) query = query.eq("main_procurement_category", category);
  if (status) query = query.eq("status", status);
  if (closingBefore) query = query.lte("tender_period_end", closingBefore);
  if (closingAfter) query = query.gte("tender_period_end", closingAfter);

  const from = (page - 1) * PAGE_SIZE;
  const { data: tendersData, count } = await query.range(from, from + PAGE_SIZE - 1);
  const tenders = (tendersData ?? []) as unknown as TenderRow[];

  const tenderIds = tenders.map((t) => t.id);
  const { data: saved } =
    tenderIds.length > 0
      ? await supabase.from("saved_tenders").select("tender_id").in("tender_id", tenderIds)
      : { data: [] as { tender_id: string }[] };
  const savedSet = new Set((saved ?? []).map((s) => s.tender_id));

  const total = count ?? 0;
  const hasMore = from + tenders.length < total;

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (province) qs.set("province", province);
    if (category) qs.set("category", category);
    if (status) qs.set("status", status);
    if (closingBefore) qs.set("closingBefore", closingBefore);
    if (closingAfter) qs.set("closingAfter", closingAfter);
    if (hasAward) qs.set("hasAward", "true");
    if (targetPage > 1) qs.set("page", String(targetPage));
    const str = qs.toString();
    return str ? `/tenders?${str}` : "/tenders";
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-akani-text-secondary">
          South African government tenders, synced from National Treasury&apos;s eTenders Transparency
          Portal.
        </p>
        <p className="mt-1 text-xs text-akani-text-muted">
          Source data is in public beta and not guaranteed to be accurate — always verify a tender
          against the official source link before relying on it for a bid decision.
        </p>
      </div>

      <div className="rounded-xl border border-akani-card-border bg-white p-4 shadow-sm">
        <TenderFilters initial={{ q, province, category, status, closingBefore, closingAfter, hasAward: String(hasAward) }} />
      </div>

      <div className="overflow-hidden rounded-xl border border-akani-card-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-akani-card-border text-left text-xs uppercase tracking-wide text-akani-text-muted">
                <th className="px-4 py-3 font-medium sm:px-6">Title</th>
                <th className="hidden px-4 py-3 font-medium sm:px-6 md:table-cell">Buyer</th>
                <th className="hidden px-4 py-3 font-medium sm:px-6 md:table-cell">Province</th>
                <th className="px-4 py-3 font-medium sm:px-6">Status</th>
                {hasAward ? (
                  <th className="px-4 py-3 font-medium sm:px-6">Award</th>
                ) : (
                  <th className="hidden px-4 py-3 font-medium sm:px-6 lg:table-cell">Closing</th>
                )}
                <th className="px-4 py-3 font-medium sm:px-6" />
              </tr>
            </thead>
            <tbody>
              {tenders.map((t) => (
                <tr key={t.id} className="border-b border-akani-card-border last:border-0 hover:bg-akani-page-bg">
                  <td className="px-4 py-3 sm:px-6">
                    <Link href={`/tenders/${t.id}`} className="font-medium text-akani-text-primary hover:text-akani-gold">
                      {t.title}
                    </Link>
                    <span className="block text-xs text-akani-text-muted md:hidden">{t.buyer_name ?? "—"}</span>
                  </td>
                  <td className="hidden px-4 py-3 text-akani-text-secondary sm:px-6 md:table-cell">
                    {t.buyer_name ?? "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-akani-text-secondary sm:px-6 md:table-cell">
                    <ProvinceBadge province={t.province_guess} />
                  </td>
                  <td className="px-4 py-3 sm:px-6">
                    <TenderStatusBadge status={t.status} />
                  </td>
                  {hasAward ? (
                    <td className="px-4 py-3 text-akani-text-secondary sm:px-6">
                      {t.tender_awards?.[0] ? (
                        <>
                          <span className="block font-medium text-akani-text-primary">
                            {t.tender_awards[0].supplier_name}
                          </span>
                          <span className="block text-xs text-akani-text-muted">
                            {t.tender_awards[0].value_amount != null
                              ? zarFormatter.format(t.tender_awards[0].value_amount)
                              : "—"}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : (
                    <td className="hidden px-4 py-3 text-akani-text-muted sm:px-6 lg:table-cell">
                      {t.tender_period_end ? new Date(t.tender_period_end).toLocaleDateString("en-ZA") : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3 sm:px-6">
                    <SaveTenderButton tenderId={t.id} initialSaved={savedSet.has(t.id)} compact />
                  </td>
                </tr>
              ))}
              {tenders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-akani-text-muted">
                    No tenders match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="font-medium text-akani-text-primary hover:text-akani-gold">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-akani-text-muted">Page {page}</span>
          {hasMore ? (
            <Link href={pageHref(page + 1)} className="font-medium text-akani-text-primary hover:text-akani-gold">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
