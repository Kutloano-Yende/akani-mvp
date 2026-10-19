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
 * across this codebase's other route tests. */
function mockTendersQuery(result: { data: unknown; error: unknown; count: number | null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "order", "textSearch", "eq", "lte", "gte"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  }
  builder.range = vi.fn(async (...args: unknown[]) => {
    calls.push({ method: "range", args });
    return result;
  });
  mockFrom.mockImplementation(() => builder);
  return { builder, calls };
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
});
