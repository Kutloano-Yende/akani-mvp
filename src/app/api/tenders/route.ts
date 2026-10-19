import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));

  let query = supabase
    .from("tenders")
    .select(TENDER_LIST_COLUMNS, { count: "exact" })
    .order("tender_period_end", { ascending: true, nullsFirst: false });

  if (q) query = query.textSearch("search_vector", q, { type: "websearch" });
  if (province) query = query.eq("province_guess", province);
  if (category) query = query.eq("main_procurement_category", category);
  if (status) query = query.eq("status", status);
  if (closingBefore) query = query.lte("tender_period_end", closingBefore);
  if (closingAfter) query = query.gte("tender_period_end", closingAfter);

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
