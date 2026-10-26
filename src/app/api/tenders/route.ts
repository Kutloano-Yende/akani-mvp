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

  // hasAward=true inner-joins tender_awards -- award data is sparse (~4% of
  // a real sample month) and not correlated with status, so this is its own
  // filter, never inferred from `status`. The inner join also lets us sort
  // by award value, which (unlike tender.value_amount) is real post-award
  // money, not the near-always-0 pre-award estimate.
  let query = supabase
    .from("tenders")
    .select(
      hasAward ? `${TENDER_LIST_COLUMNS}, tender_awards!inner(supplier_name, value_amount, value_currency)` : TENDER_LIST_COLUMNS,
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
  // Best-effort text match -- see bbeeOrFilter's own comment for why there
  // is no structured "requires B-BBEE" field to filter on instead.
  if (bbee) query = query.or(bbeeOrFilter());

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  return NextResponse.json({
    tenders: data ?? [],
    page,
    pageSize,
    hasMore: from + (data?.length ?? 0) < total,
  });
}
