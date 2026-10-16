import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockCheckProspectAccess = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}));

vi.mock("@/lib/auth/prospect-access", () => ({
  checkProspectAccess: (...args: unknown[]) => mockCheckProspectAccess(...args),
}));

import { PATCH } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/prospects/p1/status", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** Chainable mocks for `.from("prospects")` (update) and `.from("activities")` (insert). */
function mockTables(updateResult: { data: unknown; error: unknown }) {
  const prospectsBuilder = {
    update: vi.fn(() => prospectsBuilder),
    eq: vi.fn(() => prospectsBuilder),
    select: vi.fn(() => prospectsBuilder),
    single: vi.fn(async () => updateResult),
  };
  const activitiesInsert = vi.fn(async () => ({ data: null, error: null }));
  const activitiesBuilder = { insert: activitiesInsert };
  mockFrom.mockImplementation((table: string) => (table === "prospects" ? prospectsBuilder : activitiesBuilder));
  return { prospectsBuilder, activitiesInsert };
}

const params = Promise.resolve({ id: "p1" });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mockCheckProspectAccess.mockResolvedValue({ allowed: true, role: "admin", assignedTo: "user-1" });
});

describe("PATCH /api/prospects/[id]/status — lost reason", () => {
  it("rejects marking lost with no reason", async () => {
    mockTables({ data: { id: "p1", status: "lost" }, error: null });
    const res = await PATCH(request({ status: "lost" }), { params });
    expect(res.status).toBe(400);
    expect(mockCheckProspectAccess).not.toHaveBeenCalled();
  });

  it("rejects an invalid reason value", async () => {
    mockTables({ data: { id: "p1", status: "lost" }, error: null });
    const res = await PATCH(request({ status: "lost", lostReason: "not_a_real_category" }), { params });
    expect(res.status).toBe(400);
  });

  it.each([
    "not_a_fit",
    "budget_pricing",
    "no_response",
    "chose_competitor",
    "not_ready_timing",
    "invalid_contact_details",
    "other",
  ])("accepts the valid category %s", async (lostReason) => {
    const { prospectsBuilder } = mockTables({ data: { id: "p1", status: "lost" }, error: null });
    const res = await PATCH(request({ status: "lost", lostReason }), { params });
    expect(res.status).toBe(200);
    expect(prospectsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "lost", lost_reason: lostReason, lost_reason_note: null }),
    );
  });

  it("persists an optional note alongside the category", async () => {
    const { prospectsBuilder, activitiesInsert } = mockTables({ data: { id: "p1", status: "lost" }, error: null });
    const res = await PATCH(
      request({ status: "lost", lostReason: "budget_pricing", note: "  Not enough runway this quarter  " }),
      { params },
    );
    expect(res.status).toBe(200);
    expect(prospectsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ lost_reason: "budget_pricing", lost_reason_note: "Not enough runway this quarter" }),
    );
    expect(activitiesInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Status changed to lost — Budget or pricing: Not enough runway this quarter",
      }),
    );
  });

  it("omits the note from lost_reason_note when none is given", async () => {
    const { activitiesInsert } = mockTables({ data: { id: "p1", status: "lost" }, error: null });
    await PATCH(request({ status: "lost", lostReason: "no_response" }), { params });
    expect(activitiesInsert).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Status changed to lost — No response" }),
    );
  });
});

describe("PATCH /api/prospects/[id]/status — other transitions unaffected", () => {
  it("still accepts a plain status change with no lostReason involved", async () => {
    const { prospectsBuilder } = mockTables({ data: { id: "p1", status: "contacted" }, error: null });
    const res = await PATCH(request({ status: "contacted" }), { params });
    expect(res.status).toBe(200);
    expect(prospectsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "contacted", first_contacted_at: expect.any(String) }),
    );
  });

  it("still requires a reason only for lost, not for qualified", async () => {
    mockTables({ data: { id: "p1", status: "qualified" }, error: null });
    const res = await PATCH(request({ status: "qualified" }), { params });
    expect(res.status).toBe(200);
  });

  it("rejects an invalid status value entirely", async () => {
    mockTables({ data: null, error: null });
    const res = await PATCH(request({ status: "made_up_status" }), { params });
    expect(res.status).toBe(400);
  });

  it("still 401s with no authenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockTables({ data: null, error: null });
    const res = await PATCH(request({ status: "contacted" }), { params });
    expect(res.status).toBe(401);
  });

  it("still respects checkProspectAccess denying the request", async () => {
    mockCheckProspectAccess.mockResolvedValue({ allowed: false, status: 403, error: "Forbidden" });
    mockTables({ data: null, error: null });
    const res = await PATCH(request({ status: "contacted" }), { params });
    expect(res.status).toBe(403);
  });
});
