import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { TOKEN_PATTERN, unsubscribeByToken } from "./unsubscribe";

const valid = "a756cc6f-f6fe-467a-bb21-be60668bb1b7";

describe("TOKEN_PATTERN", () => {
  it("accepts a UUID and rejects anything else", () => {
    expect(TOKEN_PATTERN.test(valid)).toBe(true);
    for (const bad of ["", "xyz", `${valid}x`, `x${valid}`, `${valid}\n`, "1' or '1'='1"]) {
      expect(TOKEN_PATTERN.test(bad)).toBe(false);
    }
  });
});

describe("unsubscribeByToken", () => {
  beforeEach(() => rpc.mockReset());

  it("never hits the database for a malformed token", async () => {
    expect(await unsubscribeByToken("not-a-token")).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns true only when the database confirms", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await unsubscribeByToken(valid)).toBe(true);
    expect(rpc).toHaveBeenCalledWith("unsubscribe_by_token", { p_token: valid });
  });

  it("returns false for an unknown token or a database error", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await unsubscribeByToken(valid)).toBe(false);
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await unsubscribeByToken(valid)).toBe(false);
  });
});
