// E1: what happens to policies, functions and live logins when user_role's 'admin' is renamed?
import { execFileSync } from "node:child_process";
import { createUser, login, rest, sql, check, failed } from "../harness/lib.mjs";

const admin = await createUser("e1-admin@test.local");
const other = await createUser("e1-other@test.local");
sql(`update profiles set role='admin' where id='${admin}'`);
sql(`insert into audit_logs(action) values ('E1_PROBE')`);
let t = (await login("e1-admin@test.local")).access_token;

let r = await rest(t, "audit_logs?select=action");
check("before: admin reads audit_logs via policy", r.status === 200 && r.data.length === 1, JSON.stringify(r.data));
r = await rest(t, "rpc/admin_update_user_role", { method: "POST", body: { target_user_id: other, new_role: "manager" } });
check("before: admin_update_user_role works", r.status === 204 || r.status === 200, `status ${r.status}`);

console.log("policy text before:", sql(`select qual from pg_policies where policyname='audit logs readable by admins'`).replace(/\s+/g, " "));
sql(`alter type user_role rename value 'admin' to 'tenant_admin'`);
console.log("policy text after: ", sql(`select qual from pg_policies where policyname='audit logs readable by admins'`).replace(/\s+/g, " "));

t = (await login("e1-admin@test.local")).access_token;
r = await rest(t, "audit_logs?select=action");
check("after rename: policy still matches the renamed role (compares by enum identity)", r.status === 200 && r.data.length === 1, JSON.stringify(r.data));
check("after rename: profile now reads tenant_admin", sql(`select role from profiles where id='${admin}'`) === "tenant_admin");
r = await rest(t, "rpc/admin_update_user_role", { method: "POST", body: { target_user_id: other, new_role: "sales" } });
check("after rename: plpgsql function with the 'admin' literal BREAKS (expected: must be rewritten in same migration)", r.status >= 400, `status ${r.status} ${JSON.stringify(r.data).slice(0, 140)}`);

// ADD VALUE path (the alternative): new value cannot be used in the same transaction that adds it.
let addValueMsg = "";
try {
  execFileSync("docker", ["exec", "-i", "akani-tenancy-pg", "psql", "-U", "supabase_admin", "-h", "localhost", "-d", "akani_test", "-v", "ON_ERROR_STOP=1", "-c",
    "begin; alter type user_role add value 'platform_probe'; update profiles set role='platform_probe' where false; select 1 from profiles where role='platform_probe'; commit;"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (e) { addValueMsg = String(e.stderr).trim().split("\n")[0]; }
check("ADD VALUE then use in the same transaction is refused (so it needs its own migration)", /unsafe use of new value/i.test(addValueMsg), addValueMsg);
process.exit(failed() ? 1 : 0);
