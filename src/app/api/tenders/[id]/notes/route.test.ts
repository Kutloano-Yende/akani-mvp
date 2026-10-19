import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}));

import { PATCH } from "./route";

const params = Promise.resolve({ id: "tender-1" });

function request(body: unknown) {
  return new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

function mockSavedBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    select: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
  };
  mockFrom.mockImplementation(() => builder);
  return builder;
}

describe("PATCH /api/tenders/[id]/notes", () => {
  it("401s when signed out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(request({ notes: "hello" }), { params });
    expect(res.status).toBe(401);
  });

  it("400s when notes is not a string", async () => {
    const res = await PATCH(request({ notes: 123 }), { params });
    expect(res.status).toBe(400);
  });

  it("updates notes with no explicit tenant filter and never touches assigned_to", async () => {
    const builder = mockSavedBuilder({ data: { id: "save-1", notes: "Great fit" }, error: null });
    const res = await PATCH(request({ notes: "  Great fit  " }), { params });
    expect(res.status).toBe(200);
    expect(builder.update).toHaveBeenCalledWith({ notes: "Great fit" });
    expect(builder.eq).toHaveBeenCalledWith("tender_id", "tender-1");
  });

  it("stores an empty/whitespace-only note as null, not an empty string", async () => {
    const builder = mockSavedBuilder({ data: { id: "save-1", notes: null }, error: null });
    await PATCH(request({ notes: "   " }), { params });
    expect(builder.update).toHaveBeenCalledWith({ notes: null });
  });

  it("404s when the tender hasn't been saved yet", async () => {
    mockSavedBuilder({ data: null, error: null });
    const res = await PATCH(request({ notes: "hello" }), { params });
    expect(res.status).toBe(404);
  });

  it("500s on a database error", async () => {
    mockSavedBuilder({ data: null, error: { message: "db down" } });
    const res = await PATCH(request({ notes: "hello" }), { params });
    expect(res.status).toBe(500);
  });
});
