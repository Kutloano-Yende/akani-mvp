import { describe, expect, it, vi, beforeEach } from "vitest";

const mockRequirePlatformAdmin = vi.fn();
const mockGetUser = vi.fn();
const mockLogAudit = vi.fn();
const mockSyncTenders = vi.fn();
const mockCreateAdminClient = vi.fn(() => ({ admin: true }));

vi.mock("@/lib/auth/require-role", () => ({
  requirePlatformAdmin: () => mockRequirePlatformAdmin(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

vi.mock("@/lib/tenders/sync", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenders/sync")>("@/lib/tenders/sync");
  return {
    ...actual,
    syncTenders: (...args: unknown[]) => mockSyncTenders(...args),
  };
});

import { GET, POST } from "./route";
import { TenderSyncError } from "@/lib/tenders/sync";

const CRON_SECRET = "test-cron-secret";

function cronRequest(method: "GET" | "POST", body?: unknown) {
  return new Request("http://localhost/api/admin/tenders/sync", {
    method,
    headers: { authorization: `Bearer ${CRON_SECRET}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function plainRequest(method: "GET" | "POST", body?: unknown) {
  return new Request("http://localhost/api/admin/tenders/sync", {
    method,
    ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  mockSyncTenders.mockResolvedValue({ fetched: 10, inserted: 8, updated: 2, unmatchedProvince: 5 });
});

describe("GET /api/admin/tenders/sync (Vercel Cron)", () => {
  it("401s without the correct bearer secret", async () => {
    const res = await GET(plainRequest("GET"));
    expect(res.status).toBe(401);
    expect(mockSyncTenders).not.toHaveBeenCalled();
  });

  it("401s when CRON_SECRET isn't configured on the server", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(cronRequest("GET"));
    expect(res.status).toBe(401);
  });

  it("runs the sync for the current month and never logs an audit entry (no user session in a cron context)", async () => {
    const res = await GET(cronRequest("GET"));
    expect(res.status).toBe(200);
    expect(mockSyncTenders).toHaveBeenCalledWith(expect.anything(), undefined);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("never checks requirePlatformAdmin on the cron path", async () => {
    await GET(cronRequest("GET"));
    expect(mockRequirePlatformAdmin).not.toHaveBeenCalled();
  });

  it("maps a TenderSyncError to 502", async () => {
    mockSyncTenders.mockRejectedValue(new TenderSyncError("eTenders bulk file request failed: 500"));
    const res = await GET(cronRequest("GET"));
    expect(res.status).toBe(502);
  });
});

describe("POST /api/admin/tenders/sync (manual trigger)", () => {
  it("403s for a signed-in non-platform-admin", async () => {
    mockRequirePlatformAdmin.mockResolvedValue({ authorized: false, status: 403 });
    const res = await POST(plainRequest("POST", {}));
    expect(res.status).toBe(403);
    expect(mockSyncTenders).not.toHaveBeenCalled();
  });

  it("401s when signed out", async () => {
    mockRequirePlatformAdmin.mockResolvedValue({ authorized: false, status: 401 });
    const res = await POST(plainRequest("POST", {}));
    expect(res.status).toBe(401);
  });

  it("200s for a platform admin, passes an explicit month, and logs an audit entry", async () => {
    mockRequirePlatformAdmin.mockResolvedValue({ authorized: true, userId: "admin-1" });
    const res = await POST(plainRequest("POST", { month: "072026" }));
    expect(res.status).toBe(200);
    expect(mockSyncTenders).toHaveBeenCalledWith(expect.anything(), "072026");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "TENDERS_SYNCED" }),
    );
  });

  it("also accepts the cron-secret path on POST, skipping the platform-admin check and audit log", async () => {
    const res = await POST(cronRequest("POST", {}));
    expect(res.status).toBe(200);
    expect(mockRequirePlatformAdmin).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});
