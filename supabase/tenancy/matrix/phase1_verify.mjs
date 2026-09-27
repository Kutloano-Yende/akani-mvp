// Phase 1 verification: NOT a repeat of the Phase 0 isolation matrix (that would
// misleadingly "fail", since Phase 1 deliberately leaves the OLD, permissive RLS
// active). This checks what Phase 1 actually claims: the app keeps working exactly
// as before, tenant_id is silently and correctly assigned server-side on every new
// row, tampering with it is ignored, cross-tenant links are rejected at the FK level
// even though RLS hasn't caught up yet, and a suspended tenant is already inert.
import { createUser, login, rest, sql, check, failed } from "../harness/lib.mjs";

const AKANI = "11111111-1111-4111-8111-111111111111";

console.log("\n== 1. Existing app flows are unaffected (old RLS, unchanged) ==");
const admin = await createUser("p1-admin@test.local");
sql(`update profiles set tenant_id='${AKANI}', role='admin' where id='${admin}'`);
const sales = await createUser("p1-sales@test.local");
sql(`update profiles set tenant_id='${AKANI}' where id='${sales}'`); // role defaults to 'sales'
const adminTok = (await login("p1-admin@test.local")).access_token;
const salesTok = (await login("p1-sales@test.local")).access_token;

{
  const r = await rest(salesTok, "prospects?select=id,companies(name)&limit=3");
  check("sales user can still read prospects (old policy: true)", r.status === 200 && r.data.length > 0, `status ${r.status}`);
}
{
  const r = await rest(adminTok, "audit_logs?select=id&limit=1");
  check("admin can still read audit_logs (old policy: role=admin, unchanged)", r.status === 200, `status ${r.status}`);
}
{
  const r = await rest(salesTok, "audit_logs?select=id&limit=1");
  check("sales user still CANNOT read audit_logs (old admin-only policy, unaffected by this migration)", r.status === 200 && r.data.length === 0, JSON.stringify(r.data));
}

console.log("\n== 2. tenant_id is assigned by the server, not the client ==");
{
  const r = await rest(salesTok, "companies", { method: "POST", body: { name: "Phase1 probe" } });
  const written = r.status < 300 ? sql(`select tenant_id from companies where name='Phase1 probe'`) : null;
  check("a plain insert with no tenant_id gets tenant_id set automatically", r.status < 300 && written === AKANI, `status ${r.status}, tenant_id=${written}`);
}
{
  const fakeTenant = sql(`insert into tenants (name, slug) values ('Fake tenant','fake-tenant') returning id`).split("\n")[0];
  const r = await rest(salesTok, "companies", { method: "POST", body: { name: "Tamper probe", tenant_id: fakeTenant } });
  const written = r.status < 300 ? sql(`select tenant_id from companies where name='Tamper probe'`) : null;
  check("a client-supplied tenant_id is silently overridden, not honoured", r.status < 300 && written === AKANI, `status ${r.status}, tenant_id written=${written}`);
}

console.log("\n== 3. Cross-tenant links are rejected at the FK level (already true, ahead of RLS) ==");
{
  const otherTenant = sql(`insert into tenants (name, slug) values ('Other Co','other-co') returning id`).split("\n")[0];
  const otherCompany = sql(`insert into companies (tenant_id, name) values ('${otherTenant}','Other Co') returning id`).split("\n")[0];
  const r = await rest(adminTok, "prospects", { method: "POST", body: { company_id: otherCompany, status: "identified" } });
  check("a tenant-A prospect cannot reference another tenant's company (composite FK)", r.status >= 400, `status ${r.status} ${JSON.stringify(r.data).slice(0,120)}`);
}

console.log("\n== 4. Suspended tenant already can't write, even though RLS hasn't changed ==");
{
  sql(`update tenants set status='suspended' where id='${AKANI}'`);
  const r = await rest(salesTok, "companies", { method: "POST", body: { name: "Should be blocked" } });
  check("insert fails once the tenant is suspended (current_tenant_id() returns null)", r.status >= 400, `status ${r.status}`);
  sql(`update tenants set status='active' where id='${AKANI}'`);
  const r2 = await rest(salesTok, "companies", { method: "POST", body: { name: "Should work again" } });
  check("...and works again once reactivated", r2.status < 300, `status ${r2.status}`);
}

console.log("\n== 5. Documented, expected gap: cross-tenant SELECT is NOT yet blocked (Phase 3's job) ==");
{
  const otherTenant = sql(`insert into tenants (name, slug) values ('Visible Co','visible-co') returning id`).split("\n")[0];
  const otherCompany = sql(`insert into companies (tenant_id, name) values ('${otherTenant}','Should be visible today') returning id`).split("\n")[0];
  const r = await rest(salesTok, `companies?select=id&id=eq.${otherCompany}`);
  check("(EXPECTED, not a regression) another tenant's company is still readable -- old RLS unchanged, exactly like today's single-tenant production", r.status === 200 && r.data.length === 1, JSON.stringify(r.data));
}

console.log(`\n${failed() === 0 ? "ALL PASSED" : failed() + " FAILED"}`);
process.exit(failed() ? 1 : 0);
