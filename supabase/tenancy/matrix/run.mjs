// Phase 0 SQL security matrix, run against the DRAFT tenancy schema on the throwaway
// database (never production). Two tenants, full personas, cross-tenant probes on every
// tenant table, tenant_id tampering, suspended-tenant checks, and cross-tenant FK links.
import { createUser, login, rest, sql, check, failed } from "../harness/lib.mjs";

const T = { A: "11111111-1111-4111-8111-111111111111" }; // Akani, seeded by the draft migration
T.B = sql(`insert into tenants (name, slug) values ('Tenant B','tenant-b') returning id`).split("\n")[0];

async function makeUser(tenant, role, email) {
  const id = await createUser(email);
  sql(`update profiles set tenant_id='${tenant}', role='${role}' where id='${id}'`);
  const tok = (await login(email)).access_token;
  return { id, tok, tenant, role, email };
}

const A_admin = await makeUser(T.A, "admin", "mx-a-admin@test.local");
const A_manager = await makeUser(T.A, "manager", "mx-a-manager@test.local");
const A_sales = await makeUser(T.A, "sales", "mx-a-sales@test.local");
const B_admin = await makeUser(T.B, "admin", "mx-b-admin@test.local");
const B_sales = await makeUser(T.B, "sales", "mx-b-sales@test.local");
const platformId = await createUser("mx-platform@test.local");
sql(`insert into platform_admins (user_id) values ('${platformId}')`);
sql(`update profiles set tenant_id = null where id = '${platformId}'`);
const platform = { id: platformId, tok: (await login("mx-platform@test.local")).access_token, tenant: null, role: "platform" };

// One company/prospect per tenant, owned by that tenant's sales user.
async function seedTenant(t, salesUserId, tag) {
  const co = sql(`insert into companies (tenant_id, name, external_id, source) values ('${t}','${tag} Co','${tag}-ext','matrix') returning id`).split("\n")[0];
  const pr = sql(`insert into prospects (tenant_id, company_id, assigned_to) values ('${t}','${co}','${salesUserId}') returning id`).split("\n")[0];
  const camp = sql(`insert into campaigns (tenant_id, name, created_by) values ('${t}','${tag} campaign','${salesUserId}') returning id`).split("\n")[0];
  return { co, pr, camp };
}
const seedA = await seedTenant(T.A, A_sales.id, "A");
const seedB = await seedTenant(T.B, B_sales.id, "B");

console.log("\n== 1. Cross-tenant SELECT is invisible ==");
for (const u of [A_admin, A_manager, A_sales]) {
  const r = await rest(u.tok, `companies?select=id&id=eq.${seedB.co}`);
  check(`${u.role} A cannot SELECT tenant B's company`, r.status === 200 && r.data.length === 0, JSON.stringify(r.data));
  const r2 = await rest(u.tok, `prospects?select=id&id=eq.${seedB.pr}`);
  check(`${u.role} A cannot SELECT tenant B's prospect`, r2.status === 200 && r2.data.length === 0);
}
{
  const r = await rest(B_sales.tok, `companies?select=id&id=eq.${seedA.co}`);
  check("sales B cannot SELECT tenant A's company", r.status === 200 && r.data.length === 0);
}

console.log("\n== 2. Cross-tenant UPDATE/DELETE affect zero rows ==");
{
  const r = await rest(A_manager.tok, `prospects?id=eq.${seedB.pr}`, { method: "PATCH", body: { qualification_status: "hacked" } });
  check("manager A cannot UPDATE tenant B's prospect (0 rows affected)", r.status === 200 && (Array.isArray(r.data) ? r.data.length === 0 : true), JSON.stringify(r.data));
  const after = sql(`select qualification_status from prospects where id='${seedB.pr}'`);
  check("  ...and the row is unchanged", after === "" || after === "\\N" || after === "");
}
{
  const r = await rest(A_admin.tok, `suppression_list?email=eq.nobody@test.local`, { method: "DELETE" });
  check("admin A DELETE with no matching row returns success with zero rows (RLS hides the row, doesn't error)", r.status === 200 || r.status === 204);
}

console.log("\n== 3. Cross-tenant INSERT / tenant_id tampering ==");
{
  const r = await rest(A_sales.tok, "companies", { method: "POST", body: { name: "Injected", tenant_id: T.B } });
  const wroteTenant = r.status < 300 ? sql(`select tenant_id from companies where name='Injected'`) : null;
  check("sales A's tenant_id IS IGNORED by the insert trigger (row lands in A, not B)", r.status < 300 && wroteTenant === T.A, `status ${r.status}, tenant_id written=${wroteTenant}, body=${JSON.stringify(r.data)}`);
}
{
  const r = await rest(A_admin.tok, `companies?id=eq.${seedA.co}`, { method: "PATCH", body: { tenant_id: T.B } });
  const still = sql(`select tenant_id from companies where id='${seedA.co}'`);
  check("admin A cannot move their own company to tenant B by UPDATE", still === T.A, `now tenant_id=${still}`);
}

console.log("\n== 4. Cross-tenant links via composite FK ==");
try {
  sql(`insert into prospects (tenant_id, company_id, assigned_to) values ('${T.A}', '${seedB.co}', null) returning id`);
  check("SQL insert: tenant A prospect cannot reference tenant B's company (FK rejects)", false, "should have thrown");
} catch { check("SQL insert: tenant A prospect cannot reference tenant B's company (FK rejects)", true); }

console.log("\n== 5. Suspended tenant ==");
sql(`update tenants set status='suspended' where id='${T.B}'`);
{
  const r = await rest(B_admin.tok, "prospects?select=id");
  check("suspended tenant's admin sees NOTHING (current_tenant_id() returns null)", r.status === 200 && r.data.length === 0, JSON.stringify(r.data));
  const r2 = await rest(B_admin.tok, "companies", { method: "POST", body: { name: "should fail" } });
  check("suspended tenant's admin cannot INSERT (trigger raises: no active tenant)", r2.status >= 400, `status ${r2.status}`);
}
sql(`update tenants set status='active' where id='${T.B}'`);

console.log("\n== 6. Same-tenant rules are preserved (sales ownership) ==");
{
  const otherOwned = sql(`insert into companies (tenant_id, name) values ('${T.A}','Owned by manager') returning id`).split("\n")[0];
  const otherProspect = sql(`insert into prospects (tenant_id, company_id, assigned_to) values ('${T.A}','${otherOwned}','${A_manager.id}') returning id`).split("\n")[0];
  const r = await rest(A_sales.tok, `prospects?id=eq.${otherProspect}`, { method: "PATCH", body: { qualification_status: "x" } });
  const after = sql(`select qualification_status from prospects where id='${otherProspect}'`);
  check("sales A (same tenant) still cannot update another rep's assigned prospect", after === "" || after === "\\N");
}
{
  const r = await rest(A_sales.tok, `prospects?id=eq.${seedA.pr}`, { method: "PATCH", body: { qualification_status: "own-update-ok" } });
  const after = sql(`select qualification_status from prospects where id='${seedA.pr}'`);
  check("sales A CAN still update their own tenant's prospect assigned to them", after === "own-update-ok");
}

console.log("\n== 7. Platform admin: no blanket business-data access ==");
{
  const r = await rest(platform.tok, "companies?select=id");
  check("platform admin has NO policy granting company rows (returns empty, not an error)", r.status === 200 && r.data.length === 0, JSON.stringify(r));
  const r2 = await rest(platform.tok, "profiles?select=id,tenant_id");
  check("platform admin CAN read profiles (tenant-admin management)", r2.status === 200 && r2.data.length >= 5, JSON.stringify(r2));
}

console.log("\n== 8. Cross-tenant API-route-style probes (direct table + rpc) ==");
{
  const r = await rest(B_sales.tok, `campaign_prospects?select=id,prospects(companies(name,email,contacts(first_name,email)))&campaign_id=eq.${seedA.camp}`);
  check("tenant B cannot read tenant A's campaign_prospects via nested embed", r.status === 200 && r.data.length === 0, JSON.stringify(r.data));
}
{
  const r = await rest(A_sales.tok, "rpc/admin_update_user_role", { method: "POST", body: { target_user_id: B_admin.id, new_role: "sales" } });
  check("sales A cannot call admin_update_user_role on tenant B's admin (role check fails first)", r.status >= 400);
  const stillAdmin = sql(`select role from profiles where id='${B_admin.id}'`);
  check("  ...and tenant B's admin role is unchanged", stillAdmin === "admin");
}

console.log(`\n${failed() === 0 ? "ALL PASSED" : failed() + " FAILED"}`);
process.exit(failed() ? 1 : 0);
