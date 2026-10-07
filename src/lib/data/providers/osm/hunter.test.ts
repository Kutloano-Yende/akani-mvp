import { describe, expect, it, vi, afterEach } from "vitest";
import { domainSearch, verifyEmail } from "./hunter";

describe("domainSearch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls Hunter's domain-search endpoint with the api key and domain as query params", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = new URL(url.toString());
      expect(u.pathname).toBe("/v2/domain-search");
      expect(u.searchParams.get("domain")).toBe("example.co.za");
      expect(u.searchParams.get("api_key")).toBe("test-key");
      return {
        ok: true,
        json: async () => ({ data: { emails: [{ value: "info@example.co.za", type: "generic" }] } }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const emails = await domainSearch("test-key", "example.co.za");
    expect(emails).toEqual([{ value: "info@example.co.za", type: "generic" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns an empty array when the response has no emails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: {} }) }) as Response));
    expect(await domainSearch("test-key", "nowhere.co.za")).toEqual([]);
  });

  it("throws on a non-200 response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401 }) as Response));
    await expect(domainSearch("bad-key", "example.co.za")).rejects.toThrow(/401/);
  });
});

describe("verifyEmail", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns a lowercased status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: { status: "Valid" } }) }) as Response));
    expect(await verifyEmail("test-key", "info@example.co.za")).toEqual({ status: "valid" });
  });

  it("returns a null status when absent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: {} }) }) as Response));
    expect(await verifyEmail("test-key", "info@example.co.za")).toEqual({ status: null });
  });
});
