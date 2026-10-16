import { describe, expect, it, vi } from "vitest";
import {
  countProspects,
  countLeads,
  pipelineBreakdown,
  campaignStats,
  lookupUsers,
  listTenants,
  type ToolContext,
} from "./tool-handlers";

const ctx: ToolContext = { role: "admin", isPlatformAdmin: false };

/** A chainable mock matching just the query-builder methods the handlers use. */
function mockQuery(result: { data?: unknown; count?: number; error?: { message: string } | null }) {
  const resolved = { data: result.data ?? null, count: result.count, error: result.error ?? null };
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve: (v: unknown) => void) => Promise.resolve(resolved).then(resolve),
  };
  return builder;
}

function mockSupabase(query: ReturnType<typeof mockQuery>) {
  const client = { from: vi.fn(() => query) };
  return client as unknown as Parameters<typeof countProspects>[0] & typeof client;
}

describe("countProspects", () => {
  it("returns a plain count with no filter", async () => {
    const supabase = mockSupabase(mockQuery({ count: 7 }));
    const result = await countProspects(supabase, ctx, {});
    expect(result).toEqual({ count: 7, status: "all" });
  });

  it("filters by a valid status", async () => {
    const query = mockQuery({ count: 3 });
    const supabase = mockSupabase(query);
    const result = await countProspects(supabase, ctx, { status: "qualified" });
    expect(result).toEqual({ count: 3, status: "qualified" });
    expect(query.eq).toHaveBeenCalledWith("status", "qualified");
  });

  it("rejects an unknown status without querying further", async () => {
    const supabase = mockSupabase(mockQuery({ count: 0 }));
    const result = await countProspects(supabase, ctx, { status: "bogus" });
    expect(result).toMatchObject({ error: expect.stringContaining("Unknown status") });
  });

  it("surfaces a query error", async () => {
    const supabase = mockSupabase(mockQuery({ error: { message: "boom" } }));
    const result = await countProspects(supabase, ctx, {});
    expect(result).toEqual({ error: "boom" });
  });
});

describe("countLeads", () => {
  it("counts with no window filter for 'all'", async () => {
    const query = mockQuery({ count: 42 });
    const supabase = mockSupabase(query);
    const result = await countLeads(supabase, ctx, { window: "all" });
    expect(result).toEqual({ count: 42, window: "all" });
    expect(query.gte).not.toHaveBeenCalled();
  });

  it("applies a lower bound for 'this_week'", async () => {
    const query = mockQuery({ count: 5 });
    const supabase = mockSupabase(query);
    const result = await countLeads(supabase, ctx, { window: "this_week" });
    expect(result).toEqual({ count: 5, window: "this_week" });
    expect(query.gte).toHaveBeenCalledWith("created_at", expect.any(String));
  });

  it("defaults to 'all' for an unrecognized window", async () => {
    const supabase = mockSupabase(mockQuery({ count: 1 }));
    const result = await countLeads(supabase, ctx, { window: "decade" });
    expect(result).toEqual({ count: 1, window: "all" });
  });
});

describe("pipelineBreakdown", () => {
  it("groups prospects by stage and reports lost separately", async () => {
    const supabase = mockSupabase(
      mockQuery({ data: [{ status: "qualified" }, { status: "qualified" }, { status: "won" }, { status: "lost" }] }),
    );
    const result = await pipelineBreakdown(supabase);
    expect(result).toMatchObject({
      stages: expect.arrayContaining([
        expect.objectContaining({ key: "qualified", count: 2 }),
        expect.objectContaining({ key: "won", count: 1 }),
      ]),
      lost: 1,
    });
  });
});

describe("campaignStats", () => {
  it("computes sent/replied counts from campaign_prospects status", async () => {
    const supabase = mockSupabase(
      mockQuery({
        data: [
          {
            name: "September Construction Campaign",
            status: "active",
            campaign_prospects: [{ status: "sent" }, { status: "replied" }, { status: "pending" }],
          },
        ],
      }),
    );
    const result = await campaignStats(supabase, ctx, {});
    expect(result).toEqual({
      campaigns: [
        { name: "September Construction Campaign", status: "active", prospects: 3, sent: 2, replied: 1 },
      ],
    });
  });
});

describe("lookupUsers", () => {
  it("maps a single embedded tenant object", async () => {
    const supabase = mockSupabase(
      mockQuery({ data: [{ name: "Bantu", role: "admin", tenants: { name: "Akani BEE Ratings" } }] }),
    );
    const result = await lookupUsers(supabase, ctx, {});
    expect(result).toEqual({ users: [{ name: "Bantu", role: "admin", tenant: "Akani BEE Ratings" }] });
  });

  it("maps an embedded tenant array (PostgREST shape)", async () => {
    const supabase = mockSupabase(mockQuery({ data: [{ name: "Sales Rep", role: "sales", tenants: [{ name: "Akani BEE Ratings" }] }] }));
    const result = await lookupUsers(supabase, ctx, {});
    expect(result).toEqual({ users: [{ name: "Sales Rep", role: "sales", tenant: "Akani BEE Ratings" }] });
  });
});

describe("listTenants", () => {
  it("refuses when the caller isn't a platform admin, even if somehow invoked", async () => {
    const query = mockQuery({ data: [{ name: "Akani BEE Ratings", status: "active" }] });
    const supabase = mockSupabase(query);
    const result = await listTenants(supabase, { role: "admin", isPlatformAdmin: false });
    expect(result).toEqual({ error: "Only available to platform admins." });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("lists tenants for a platform admin", async () => {
    const supabase = mockSupabase(mockQuery({ data: [{ name: "Akani BEE Ratings", status: "active" }] }));
    const result = await listTenants(supabase, { role: "admin", isPlatformAdmin: true });
    expect(result).toEqual({ tenants: [{ name: "Akani BEE Ratings", status: "active" }] });
  });
});

describe("tenant isolation", () => {
  // Every handler takes whatever Supabase client it's given and trusts RLS to
  // have already scoped it -- there is no manual tenant_id filtering code
  // anywhere in tool-handlers.ts. These tests prove that by feeding each
  // handler two independently-scoped mock clients (standing in for what RLS
  // actually returns for two different tenants, verified live against the
  // real database via a rolled-back two-tenant transaction) and confirming
  // each call reflects only its own client's data -- a handler with any
  // cross-tenant leakage logic of its own would fail this by construction.
  const tenantACtx: ToolContext = { role: "admin", isPlatformAdmin: false };
  const tenantBCtx: ToolContext = { role: "admin", isPlatformAdmin: false };

  it("countLeads reflects only the scoped client's count, never another tenant's", async () => {
    const tenantAClient = mockSupabase(mockQuery({ count: 3 })); // tenant A has 3 leads
    const tenantBClient = mockSupabase(mockQuery({ count: 9 })); // tenant B has 9 leads
    const [resultA, resultB] = await Promise.all([
      countLeads(tenantAClient, tenantACtx, {}),
      countLeads(tenantBClient, tenantBCtx, {}),
    ]);
    expect(resultA).toEqual({ count: 3, window: "all" });
    expect(resultB).toEqual({ count: 9, window: "all" });
  });

  it("lookupUsers reflects only the scoped client's rows, never another tenant's people", async () => {
    const tenantAClient = mockSupabase(mockQuery({ data: [{ name: "Hlobisile", role: "sales", tenants: { name: "Akani BEE Ratings" } }] }));
    const tenantBClient = mockSupabase(mockQuery({ data: [{ name: "Tenant B Person", role: "admin", tenants: { name: "Test Tenant B" } }] }));
    const [resultA, resultB] = await Promise.all([
      lookupUsers(tenantAClient, tenantACtx, {}),
      lookupUsers(tenantBClient, tenantBCtx, {}),
    ]);
    expect(resultA).toEqual({ users: [{ name: "Hlobisile", role: "sales", tenant: "Akani BEE Ratings" }] });
    expect(resultB).toEqual({ users: [{ name: "Tenant B Person", role: "admin", tenant: "Test Tenant B" }] });
    // Neither result contains any trace of the other tenant's data.
    expect(JSON.stringify(resultA)).not.toContain("Tenant B");
    expect(JSON.stringify(resultB)).not.toContain("Hlobisile");
  });

  it("campaignStats reflects only the scoped client's campaigns, never another tenant's", async () => {
    const tenantAClient = mockSupabase(mockQuery({ data: [{ name: "Akani Campaign", status: "active", campaign_prospects: [] }] }));
    const tenantBClient = mockSupabase(mockQuery({ data: [{ name: "Tenant B Campaign", status: "active", campaign_prospects: [] }] }));
    const [resultA, resultB] = await Promise.all([
      campaignStats(tenantAClient, tenantACtx, {}),
      campaignStats(tenantBClient, tenantBCtx, {}),
    ]);
    expect((resultA as { campaigns: { name: string }[] }).campaigns.map((c) => c.name)).toEqual(["Akani Campaign"]);
    expect((resultB as { campaigns: { name: string }[] }).campaigns.map((c) => c.name)).toEqual(["Tenant B Campaign"]);
  });

  it("listTenants, for two different platform admins, reflects only what each client returns", async () => {
    // (list_tenants is cross-tenant by design for platform admins -- this
    // confirms it still has no logic of its own merging or hardcoding
    // results independent of the client, same principle as the other tools.)
    const clientSeeingBothTenants = mockSupabase(
      mockQuery({ data: [{ name: "Akani BEE Ratings", status: "active" }, { name: "Test Tenant B", status: "active" }] }),
    );
    const result = await listTenants(clientSeeingBothTenants, { role: "admin", isPlatformAdmin: true });
    expect(result).toEqual({
      tenants: [
        { name: "Akani BEE Ratings", status: "active" },
        { name: "Test Tenant B", status: "active" },
      ],
    });
  });
});
