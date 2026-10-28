import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}));

import { GET } from "./route";

function request(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return new Request(`http://localhost/api/tenders${qs ? `?${qs}` : ""}`);
}

/** Chainable mock covering every filter method the route calls, resolving
 * only once `.range()` is reached -- same "thenable builder" shape used
 * across this codebase's other route tests. Also records which table
 * `.from()` was called with, since hasAward=true now queries FROM
 * tender_awards instead of tenders (see route.ts's own comment on why). */
function mockTendersQuery(result: { data: unknown; error: unknown; count: number | null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const fromCalls: string[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "order", "textSearch", "eq", "lte", "gte", "or"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  }
  builder.range = vi.fn(async (...args: unknown[]) => {
    calls.push({ method: "range", args });
    return result;
  });
  mockFrom.mockImplementation((table: string) => {
    fromCalls.push(table);
    return builder;
  });
  return { builder, calls, fromCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("GET /api/tenders", () => {
  it("401s when signed out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockTendersQuery({ data: [], error: null, count: 0 });
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it("returns the default page with no filters", async () => {
    mockTendersQuery({ data: [{ id: "t1" }], error: null, count: 1 });
    const res = await GET(request());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ tenders: [{ id: "t1" }], page: 1, pageSize: 25, hasMore: false });
  });

  it("maps query params to the right filter calls", async () => {
    const { builder } = mockTendersQuery({ data: [], error: null, count: 0 });
    await GET(
      request({
        q: "construction",
        province: "Gauteng",
        category: "works",
        status: "active",
        closingBefore: "2026-12-31",
        closingAfter: "2026-10-01",
      }),
    );
    expect(builder.textSearch).toHaveBeenCalledWith("search_vector", "construction", { type: "websearch" });
    expect(builder.eq).toHaveBeenCalledWith("province_guess", "Gauteng");
    expect(builder.eq).toHaveBeenCalledWith("main_procurement_category", "works");
    expect(builder.eq).toHaveBeenCalledWith("status", "active");
    expect(builder.lte).toHaveBeenCalledWith("tender_period_end", "2026-12-31");
    expect(builder.gte).toHaveBeenCalledWith("tender_period_end", "2026-10-01");
  });

  it("paginates via range and reports hasMore correctly", async () => {
    mockTendersQuery({ data: new Array(25).fill({ id: "t" }), error: null, count: 60 });
    const res = await GET(request({ page: "1", pageSize: "25" }));
    const body = await res.json();
    expect(body.hasMore).toBe(true);
  });

  it("caps pageSize at the documented maximum", async () => {
    const { builder } = mockTendersQuery({ data: [], error: null, count: 0 });
    await GET(request({ pageSize: "99999" }));
    expect(builder.range).toHaveBeenCalledWith(0, 99); // pageSize capped to 100 -> last index 99
  });

  it("returns 500 on a query error", async () => {
    mockTendersQuery({ data: null, error: { message: "db down" }, count: null });
    const res = await GET(request());
    expect(res.status).toBe(500);
  });

  it("queries FROM tender_awards (not tenders) and sorts by award value when hasAward=true", async () => {
    // Ordering `tenders` by a column on its embedded tender_awards doesn't
    // work in PostgREST (one-to-many parent order is undefined) -- the
    // route queries FROM tender_awards instead, embedding `tenders`, so
    // value_amount is a plain top-level column PostgREST can actually sort.
    const { builder, fromCalls } = mockTendersQuery({ data: [], error: null, count: 0 });
    await GET(request({ hasAward: "true" }));
    expect(fromCalls).toEqual(["tender_awards"]);
    expect(builder.select).toHaveBeenCalledWith(
      expect.stringContaining("tenders!inner("),
      { count: "exact" },
    );
    expect(builder.order).toHaveBeenCalledWith("value_amount", { ascending: false, nullsFirst: false });
  });

  it("targets filters at the embedded tenders.* columns when combined with hasAward=true", async () => {
    const { builder } = mockTendersQuery({ data: [], error: null, count: 0 });
    await GET(request({ hasAward: "true", province: "Gauteng", status: "active" }));
    expect(builder.eq).toHaveBeenCalledWith("tenders.province_guess", "Gauteng");
    expect(builder.eq).toHaveBeenCalledWith("tenders.status", "active");
  });

  it("normalizes the hasAward=true response back to tender fields + an embedded tender_awards array", async () => {
    mockTendersQuery({
      data: [
        {
          supplier_name: "VODACOM",
          value_amount: 50871120,
          value_currency: "ZAR",
          tenders: { id: "t1", title: "CETA - 04" },
        },
      ],
      error: null,
      count: 1,
    });
    const res = await GET(request({ hasAward: "true" }));
    const body = await res.json();
    expect(body.tenders).toEqual([
      {
        id: "t1",
        title: "CETA - 04",
        tender_awards: [{ supplier_name: "VODACOM", value_amount: 50871120, value_currency: "ZAR" }],
      },
    ]);
  });

  it("sorts by closing date and selects only the base columns when hasAward is absent", async () => {
    const { builder } = mockTendersQuery({ data: [], error: null, count: 0 });
    await GET(request());
    expect(builder.select).toHaveBeenCalledWith(
      "id, ocid, title, status, main_procurement_category, buyer_name, province_guess, tender_period_end, source_url",
      { count: "exact" },
    );
    expect(builder.order).toHaveBeenCalledWith("tender_period_end", { ascending: true, nullsFirst: false });
  });

  it("applies the B-BBEE keyword filter when bbee=true", async () => {
    const { builder } = mockTendersQuery({ data: [], error: null, count: 0 });
    await GET(request({ bbee: "true" }));
    expect(builder.or).toHaveBeenCalledWith(expect.stringContaining("title.ilike.%B-BBEE%"));
  });

  it("never applies the B-BBEE filter when bbee is absent", async () => {
    const { builder } = mockTendersQuery({ data: [], error: null, count: 0 });
    await GET(request());
    expect(builder.or).not.toHaveBeenCalled();
  });

  it("scopes the B-BBEE filter to the embedded tenders table when combined with hasAward=true", async () => {
    const { builder } = mockTendersQuery({ data: [], error: null, count: 0 });
    await GET(request({ hasAward: "true", bbee: "true" }));
    expect(builder.or).toHaveBeenCalledWith(expect.stringContaining("title.ilike.%B-BBEE%"), {
      foreignTable: "tenders",
    });
  });
});
