import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}));

import { POST, DELETE } from "./route";

const params = Promise.resolve({ id: "tender-1" });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("POST /api/tenders/[id]/save", () => {
  it("401s when signed out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(new Request("http://localhost"), { params });
    expect(res.status).toBe(401);
  });

  it("inserts a saved_tenders row scoped to the caller, never a client-supplied tenant_id", async () => {
    const insertArg = { current: null as unknown };
    const builder = {
      insert: vi.fn((row: unknown) => {
        insertArg.current = row;
        return builder;
      }),
      select: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: { id: "save-1", tender_id: "tender-1" }, error: null })),
    };
    mockFrom.mockImplementation(() => builder);

    const res = await POST(new Request("http://localhost"), { params });
    expect(res.status).toBe(200);
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ tender_id: "tender-1", saved_by: "user-1", tenant_id: undefined }),
    );
    // withServerTenant's real behavior: JSON.stringify drops an undefined
    // property entirely, so the value genuinely never reaches the wire.
    expect(JSON.stringify(insertArg.current)).not.toContain("tenant_id");
  });

  it("maps a unique-violation to a friendly 'already saved' message", async () => {
    const builder = {
      insert: vi.fn(() => builder),
      select: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: null, error: { code: "23505", message: "duplicate key" } })),
    };
    mockFrom.mockImplementation(() => builder);

    const res = await POST(new Request("http://localhost"), { params });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("This tender is already saved");
  });
});

describe("DELETE /api/tenders/[id]/save", () => {
  it("401s when signed out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE(new Request("http://localhost"), { params });
    expect(res.status).toBe(401);
  });

  it("deletes with no explicit tenant filter in app code -- RLS is the enforcement", async () => {
    const builder = {
      delete: vi.fn(() => builder),
      eq: vi.fn(() => Promise.resolve({ error: null, count: 1 })),
    };
    mockFrom.mockImplementation(() => builder);

    const res = await DELETE(new Request("http://localhost"), { params });
    expect(res.status).toBe(200);
    expect(builder.delete).toHaveBeenCalledWith({ count: "exact" });
    expect(builder.eq).toHaveBeenCalledWith("tender_id", "tender-1");
  });

  it("404s when nothing was deleted (not this tenant's save, or none exists)", async () => {
    const builder = {
      delete: vi.fn(() => builder),
      eq: vi.fn(() => Promise.resolve({ error: null, count: 0 })),
    };
    mockFrom.mockImplementation(() => builder);

    const res = await DELETE(new Request("http://localhost"), { params });
    expect(res.status).toBe(404);
  });
});
