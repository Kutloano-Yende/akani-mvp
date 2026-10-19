import { describe, expect, it, vi, beforeEach } from "vitest";

const mockRequireRole = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/auth/require-role", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: mockFrom }),
}));

import { PATCH } from "./route";

const params = Promise.resolve({ id: "tender-1" });

function request(body: unknown) {
  return new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/tenders/[id]/assign", () => {
  it("403s for a sales user (not admin/manager)", async () => {
    mockRequireRole.mockResolvedValue({ authorized: false, status: 403 });
    const res = await PATCH(request({ assigneeId: "user-2" }), { params });
    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(["admin", "manager"]);
  });

  it("401s when signed out", async () => {
    mockRequireRole.mockResolvedValue({ authorized: false, status: 401 });
    const res = await PATCH(request({ assigneeId: "user-2" }), { params });
    expect(res.status).toBe(401);
  });

  it("200s for an admin and updates assigned_to with no explicit tenant filter", async () => {
    mockRequireRole.mockResolvedValue({ authorized: true, userId: "admin-1", role: "admin" });
    const profilesBuilder = { select: vi.fn(() => profilesBuilder), eq: vi.fn(() => profilesBuilder), maybeSingle: vi.fn(async () => ({ data: { id: "user-2" } })) };
    const savedBuilder = {
      update: vi.fn(() => savedBuilder),
      eq: vi.fn(() => savedBuilder),
      select: vi.fn(() => savedBuilder),
      maybeSingle: vi.fn(async () => ({ data: { id: "save-1", assigned_to: "user-2" }, error: null })),
    };
    mockFrom.mockImplementation((table: string) => (table === "profiles" ? profilesBuilder : savedBuilder));

    const res = await PATCH(request({ assigneeId: "user-2" }), { params });
    expect(res.status).toBe(200);
    expect(savedBuilder.update).toHaveBeenCalledWith({ assigned_to: "user-2" });
    expect(savedBuilder.eq).toHaveBeenCalledWith("tender_id", "tender-1");
  });

  it("200s for a manager unassigning (assigneeId null)", async () => {
    mockRequireRole.mockResolvedValue({ authorized: true, userId: "mgr-1", role: "manager" });
    const savedBuilder = {
      update: vi.fn(() => savedBuilder),
      eq: vi.fn(() => savedBuilder),
      select: vi.fn(() => savedBuilder),
      maybeSingle: vi.fn(async () => ({ data: { id: "save-1", assigned_to: null }, error: null })),
    };
    mockFrom.mockImplementation(() => savedBuilder);

    const res = await PATCH(request({ assigneeId: null }), { params });
    expect(res.status).toBe(200);
    expect(savedBuilder.update).toHaveBeenCalledWith({ assigned_to: null });
  });

  it("400s when the assignee doesn't exist", async () => {
    mockRequireRole.mockResolvedValue({ authorized: true, userId: "admin-1", role: "admin" });
    const profilesBuilder = { select: vi.fn(() => profilesBuilder), eq: vi.fn(() => profilesBuilder), maybeSingle: vi.fn(async () => ({ data: null })) };
    mockFrom.mockImplementation(() => profilesBuilder);

    const res = await PATCH(request({ assigneeId: "ghost" }), { params });
    expect(res.status).toBe(400);
  });

  it("404s when the tender hasn't been saved yet", async () => {
    mockRequireRole.mockResolvedValue({ authorized: true, userId: "admin-1", role: "admin" });
    const profilesBuilder = { select: vi.fn(() => profilesBuilder), eq: vi.fn(() => profilesBuilder), maybeSingle: vi.fn(async () => ({ data: { id: "user-2" } })) };
    const savedBuilder = {
      update: vi.fn(() => savedBuilder),
      eq: vi.fn(() => savedBuilder),
      select: vi.fn(() => savedBuilder),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    };
    mockFrom.mockImplementation((table: string) => (table === "profiles" ? profilesBuilder : savedBuilder));

    const res = await PATCH(request({ assigneeId: "user-2" }), { params });
    expect(res.status).toBe(404);
  });
});
