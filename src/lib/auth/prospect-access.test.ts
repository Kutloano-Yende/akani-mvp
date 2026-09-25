import { describe, expect, it } from "vitest";
import { canModifyProspect, checkProspectAccess } from "./prospect-access";

describe("canModifyProspect", () => {
  it("lets sales change unassigned and their own prospects only", () => {
    expect(canModifyProspect("sales", "u1", null)).toBe(true);
    expect(canModifyProspect("sales", "u1", "u1")).toBe(true);
    expect(canModifyProspect("sales", "u1", "u2")).toBe(false);
  });

  it("lets managers and admins change any prospect", () => {
    for (const role of ["manager", "admin"] as const) {
      expect(canModifyProspect(role, "u1", "u2")).toBe(true);
      expect(canModifyProspect(role, "u1", null)).toBe(true);
    }
  });
});

// Minimal stand-in for the Supabase query builder: enough for the two
// single-row lookups checkProspectAccess makes.
function fakeClient(tables: { profiles: unknown; prospects: unknown }) {
  return {
    from: (table: "profiles" | "prospects") => {
      const result = { data: tables[table] };
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: async () => result,
        maybeSingle: async () => result,
      };
      return chain;
    },
  } as never;
}

describe("checkProspectAccess", () => {
  it("404s when the prospect doesn't exist", async () => {
    const r = await checkProspectAccess(fakeClient({ profiles: { role: "sales" }, prospects: null }), "u1", "p1");
    expect(r).toMatchObject({ allowed: false, status: 404 });
  });

  it("403s a sales user on someone else's prospect", async () => {
    const r = await checkProspectAccess(
      fakeClient({ profiles: { role: "sales" }, prospects: { assigned_to: "u2" } }),
      "u1",
      "p1",
    );
    expect(r).toMatchObject({ allowed: false, status: 403 });
  });

  it("allows a manager on someone else's prospect and reports role and owner", async () => {
    const r = await checkProspectAccess(
      fakeClient({ profiles: { role: "manager" }, prospects: { assigned_to: "u2" } }),
      "u1",
      "p1",
    );
    expect(r).toEqual({ allowed: true, role: "manager", assignedTo: "u2" });
  });

  it("denies when the caller has no profile", async () => {
    const r = await checkProspectAccess(fakeClient({ profiles: null, prospects: { assigned_to: null } }), "u1", "p1");
    expect(r).toMatchObject({ allowed: false, status: 403 });
  });
});
