import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bbeeOrFilter } from "@/lib/tenders/constants";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const TENDER_LIST_COLUMNS =
  "id, ocid, title, status, main_procurement_category, buyer_name, province_guess, tender_period_end, source_url";

/**
 * Lists/filters the global tender catalog. No tenant scoping -- tenders is
 * deliberately global (RLS: `select ... using (true)` for every
 * authenticated user), so this is a plain read, same as any other
 * read-only reference-data endpoint.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const province = url.searchParams.get("province")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const closingBefore = url.searchParams.get("closingBefore")?.trim();
  const closingAfter = url.searchParams.get("closingAfter")?.trim();
  const hasAward = url.searchParams.get("hasAward") === "true";
  const bbee = url.searchParams.get("bbee") === "true";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));

  // hasAward=true needs results sorted by real award value. PostgREST can't
  // order `tenders` by a column on its EMBEDDED tender_awards (confirmed
  // live: it silently ignored the order and fell back to default row
  // order) -- tenders:tender_awards is one-to-many, and ordering a parent
  // by a column on its many-side isn't well-defined. Querying FROM
  // tender_awards instead avoids the ambiguity: the sort column becomes a
  // plain top-level column on the base table, and the embedded `tenders` is
  // to-one (every award belongs to exactly one tender), which IS
  // orderable/filterable. The other filters below target the embedded
  // `tenders.<column>` in this branch for the same reason.
  let query = hasAward
    ? supabase
        .from("tender_awards")
        .select(`supplier_name, value_amount, value_currency, tenders!inner(${TENDER_LIST_COLUMNS})`, { count: "exact" })
        .order("value_amount", { ascending: false, nullsFirst: false })
    : supabase.from("tenders").select(TENDER_LIST_COLUMNS, { count: "exact" }).order("tender_period_end", {
        ascending: true,
        nullsFirst: false,
      });

  const col = (name: string) => (hasAward ? `tenders.${name}` : name);
  if (q) query = query.textSearch(col("search_vector"), q, { type: "websearch" });
  if (province) query = query.eq(col("province_guess"), province);
  if (category) query = query.eq(col("main_procurement_category"), category);
  if (status) query = query.eq(col("status"), status);
  if (closingBefore) query = query.lte(col("tender_period_end"), closingBefore);
  if (closingAfter) query = query.gte(col("tender_period_end"), closingAfter);
  // Best-effort text match -- see bbeeOrFilter's own comment for why there
  // is no structured "requires B-BBEE" field to filter on instead.
  if (bbee) query = hasAward ? query.or(bbeeOrFilter(), { foreignTable: "tenders" }) : query.or(bbeeOrFilter());

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Normalize back to the same shape regardless of hasAward, so API
  // consumers always see tender fields + an embedded tender_awards array,
  // never the inverted tender_awards-with-embedded-tender shape this branch
  // has to query in to get a working sort.
  type AwardJoinRow = {
    supplier_name: string;
    value_amount: number | null;
    value_currency: string | null;
    tenders: Record<string, unknown>;
  };
  const tenders = hasAward
    ? ((data ?? []) as unknown as AwardJoinRow[]).map((r) => ({
        ...r.tenders,
        tender_awards: [{ supplier_name: r.supplier_name, value_amount: r.value_amount, value_currency: r.value_currency }],
      }))
    : (data ?? []);

  const total = count ?? 0;
  return NextResponse.json({
    tenders,
    page,
    pageSize,
    hasMore: from + (data?.length ?? 0) < total,
  });
}
