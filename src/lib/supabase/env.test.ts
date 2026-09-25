import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseEnv, requireSupabaseEnv } from "./env";

describe("supabase env", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reports every missing variable by name", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(getSupabaseEnv().missing).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]);
  });

  it("reports only what is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(getSupabaseEnv().missing).toEqual(["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  });

  it("returns the values when both are set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "key");
    expect(requireSupabaseEnv()).toEqual({ url: "https://x.supabase.co", anonKey: "key", missing: [] });
  });

  it("throws a message naming the variable when required and absent", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "key");
    expect(() => requireSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
