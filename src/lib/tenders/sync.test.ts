import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchMonthlyReleases, monthlyFileUrl, syncTenders, TenderSyncError } from "./sync";
import type { OcdsRelease } from "./ocds-types";

function release(overrides: Partial<OcdsRelease> = {}): OcdsRelease {
  return {
    ocid: "ocds-9t57fa-163705",
    id: "ocds-9t57fa-163705-2026-07-28",
    date: "2026-07-28T00:00:00Z",
    tag: ["compiled"],
    tender: {
      id: "163705",
      title: "Dev 06 2026 27",
      status: "active",
      mainProcurementCategory: "services",
      documents: [],
    },
    buyer: { id: "629", name: "Special Investigation Unit" },
    ...overrides,
  };
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("monthlyFileUrl", () => {
  it("builds the expected download URL", () => {
    expect(monthlyFileUrl("072026")).toBe(
      "https://data.etenders.gov.za/Home/DownloadFile/?fileName=01072026.json",
    );
  });

  it("rejects a malformed month", () => {
    expect(() => monthlyFileUrl("july2026")).toThrow(TenderSyncError);
  });
});

describe("fetchMonthlyReleases", () => {
  it("parses a successful response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ Releases: [release()] }),
    }) as unknown as typeof fetch;

    const pkg = await fetchMonthlyReleases("072026");
    expect(pkg.Releases).toHaveLength(1);
  });

  it("throws a clean error on 404 (month not yet published)", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    await expect(fetchMonthlyReleases("122099")).rejects.toThrow(/No bulk file published/);
  });

  it("throws a clean error on malformed JSON", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("boom");
      },
    }) as unknown as typeof fetch;
    await expect(fetchMonthlyReleases("072026")).rejects.toThrow(/not valid JSON/);
  });

  it("throws a clean error when Releases is missing", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
    await expect(fetchMonthlyReleases("072026")).rejects.toThrow(/no Releases array/);
  });
});

describe("syncTenders", () => {
  function mockAdmin(existingOcids: string[] = []) {
    const upsertCalls: unknown[][] = [];
    const tendersBuilder = {
      select: vi.fn(() => tendersBuilder),
      in: vi.fn(async () => ({ data: existingOcids.map((ocid) => ({ ocid })), error: null })),
      upsert: vi.fn(async (rows: unknown[]) => {
        upsertCalls.push(rows);
        return { error: null };
      }),
    };
    const admin = { from: vi.fn(() => tendersBuilder) };
    return { admin, tendersBuilder, upsertCalls };
  }

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Releases: [
          release({ ocid: "ocds-9t57fa-1" }),
          release({ ocid: "ocds-9t57fa-2", tender: { ...release().tender, mainProcurementCategory: "" } }),
        ],
      }),
    }) as unknown as typeof fetch;
  });

  it("reports inserted vs updated based on what already exists", async () => {
    const { admin, upsertCalls } = mockAdmin(["ocds-9t57fa-1"]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await syncTenders(admin as any, "072026");
    expect(result.fetched).toBe(2);
    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(1);
    expect(upsertCalls).toHaveLength(1);
    expect((upsertCalls[0] as { ocid: string }[]).map((r) => r.ocid).sort()).toEqual([
      "ocds-9t57fa-1",
      "ocds-9t57fa-2",
    ]);
  });

  it("counts rows with no derivable province as unmatchedProvince", async () => {
    const { admin } = mockAdmin([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await syncTenders(admin as any, "072026");
    expect(result.unmatchedProvince).toBe(2); // neither release's buyer name carries a province signal
  });

  it("dedupes within the batch by ocid before counting/upserting", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Releases: [
          release({ ocid: "ocds-9t57fa-1", date: "2026-07-01T00:00:00Z" }),
          release({ ocid: "ocds-9t57fa-1", date: "2026-07-28T00:00:00Z" }),
        ],
      }),
    }) as unknown as typeof fetch;
    const { admin, upsertCalls } = mockAdmin([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await syncTenders(admin as any, "072026");
    expect(result.fetched).toBe(2); // raw count before dedup
    expect(result.inserted).toBe(1); // deduped before insert/update counting
    expect(upsertCalls[0]).toHaveLength(1);
  });

  it("never calls upsert when the fetch/parse step fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    const { admin, tendersBuilder } = mockAdmin([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(syncTenders(admin as any, "072026")).rejects.toThrow(TenderSyncError);
    expect(tendersBuilder.upsert).not.toHaveBeenCalled();
  });

  it("surfaces an upsert error rather than silently dropping rows", async () => {
    const { admin, tendersBuilder } = mockAdmin([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tendersBuilder as any).upsert = vi.fn(async () => ({ error: { message: "constraint violation" } }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(syncTenders(admin as any, "072026")).rejects.toThrow(/constraint violation/);
  });
});
