import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}));

import { GET } from "./route";

const params = Promise.resolve({ id: "tender-1" });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

function mockBuilders({
  tender,
  savedTender,
  awards = { data: [] },
}: {
  tender: { data: unknown; error: unknown };
  savedTender: { data: unknown };
  awards?: { data: unknown };
}) {
  const tendersBuilder = {
    select: vi.fn(() => tendersBuilder),
    eq: vi.fn(() => tendersBuilder),
    maybeSingle: vi.fn(async () => tender),
  };
  const savedBuilder = {
    select: vi.fn(() => savedBuilder),
    eq: vi.fn(() => savedBuilder),
    limit: vi.fn(() => savedBuilder),
    maybeSingle: vi.fn(async () => savedTender),
  };
  const awardsBuilder = {
    select: vi.fn(() => awardsBuilder),
    eq: vi.fn(async () => awards),
  };
  mockFrom.mockImplementation((table: string) =>
    table === "tenders" ? tendersBuilder : table === "saved_tenders" ? savedBuilder : awardsBuilder,
  );
  return { tendersBuilder, savedBuilder, awardsBuilder };
}

describe("GET /api/tenders/[id]", () => {
  it("401s when signed out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(401);
  });

  it("404s when the tender doesn't exist", async () => {
    mockBuilders({ tender: { data: null, error: null }, savedTender: { data: null } });
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(404);
  });

  it("500s on a tenders query error", async () => {
    mockBuilders({ tender: { data: null, error: { message: "db down" } }, savedTender: { data: null } });
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(500);
  });

  it("returns the tender with savedTender null when nobody has saved it", async () => {
    mockBuilders({ tender: { data: { id: "tender-1", title: "X" }, error: null }, savedTender: { data: null } });
    const res = await GET(new Request("http://localhost"), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.tender).toEqual({ id: "tender-1", title: "X" });
    expect(body.savedTender).toBeNull();
  });

  it("returns the caller's savedTender when it exists", async () => {
    mockBuilders({
      tender: { data: { id: "tender-1", title: "X" }, error: null },
      savedTender: { data: { id: "save-1", tender_id: "tender-1" } },
    });
    const res = await GET(new Request("http://localhost"), { params });
    const body = await res.json();
    expect(body.savedTender).toEqual({ id: "save-1", tender_id: "tender-1" });
  });

  it("limits the saved_tenders lookup to 1 row before maybeSingle -- a platform admin's read policy spans every tenant, so more than one tenant could have saved the same global tender", async () => {
    const { savedBuilder } = mockBuilders({
      tender: { data: { id: "tender-1", title: "X" }, error: null },
      savedTender: { data: { id: "save-1" } },
    });
    await GET(new Request("http://localhost"), { params });
    expect(savedBuilder.limit).toHaveBeenCalledWith(1);
  });

  it("returns an empty awards array when the tender has none", async () => {
    mockBuilders({
      tender: { data: { id: "tender-1", title: "X" }, error: null },
      savedTender: { data: null },
    });
    const res = await GET(new Request("http://localhost"), { params });
    const body = await res.json();
    expect(body.awards).toEqual([]);
  });

  it("returns award signals -- supplier_name/value only, never a contact field", async () => {
    mockBuilders({
      tender: { data: { id: "tender-1", title: "X" }, error: null },
      savedTender: { data: null },
      awards: { data: [{ supplier_name: "VODACOM", value_amount: 50871120, value_currency: "ZAR" }] },
    });
    const res = await GET(new Request("http://localhost"), { params });
    const body = await res.json();
    expect(body.awards).toEqual([{ supplier_name: "VODACOM", value_amount: 50871120, value_currency: "ZAR" }]);
  });
});
