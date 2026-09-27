// E3: the app reads related rows with PostgREST embeds like prospects?select=companies(name),profiles(name).
// What happens to those when a composite (tenant_id, x) foreign key is added next to the existing one,
// and when it replaces it? Runs through the real PostgREST with a real login.
import { createUser, login, rest, sql, check, failed } from "../harness/lib.mjs";

const T = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tables = ["profiles", "companies", "contacts", "prospects", "campaigns", "campaign_prospects", "activities", "audit_logs", "api_usage"];
for (const t of tables) sql(`alter table ${t} add column tenant_id uuid not null default '${T}'`);
for (const t of ["profiles", "companies", "prospects", "campaigns"]) sql(`alter table ${t} add constraint ${t}_tid_id unique (tenant_id, id)`);

const user = await createUser("e3-user@test.local");
sql(`insert into campaigns (name) values ('E3 campaign')`);
sql(`update prospects set assigned_to='${user}' where id in (select id from prospects limit 3)`);
sql(`insert into campaign_prospects (campaign_id, prospect_id) select (select id from campaigns limit 1), id from prospects limit 2`);
sql(`insert into activities (prospect_id, user_id, type) select id, '${user}', 'X' from prospects limit 1`);
sql(`insert into api_usage (user_id, provider, endpoint, results_returned, credits_used) values ('${user}','p','e',1,1)`);
sql(`insert into audit_logs (action, user_id) values ('E3', '${user}')`);
sql(`update profiles set role='admin' where id='${user}'`); // audit_logs is admin-only to read
const tok = (await login("e3-user@test.local")).access_token;

const QUERIES = {
  "pipeline: prospects→companies": "prospects?select=id,status,opportunity_score,companies(name,industry)",
  "list: prospects→companies + profiles(name)": "prospects?select=id,status,companies(name,industry,province),profiles(name)",
  "detail: prospects→companies(*)": "prospects?select=*,companies(*)&limit=1",
  "audit log: audit_logs→profiles(name)": "audit_logs?select=id,action,profiles(name)",
  "usage: api_usage→profiles(name)": "api_usage?select=id,provider,profiles(name)",
  "activity: activities→profiles(name)": "activities?select=*,profiles(name)",
  "campaign send: 3-level nested embed": "campaign_prospects?select=id,prospects(companies(name,email,contacts(first_name,email)))",
};
const reload = async () => { sql(`notify pgrst, 'reload schema'`); await new Promise((r) => setTimeout(r, 2500)); };
async function runAll(label) {
  const out = {};
  for (const [name, q] of Object.entries(QUERIES)) {
    const r = await rest(tok, q);
    out[name] = r;
    const ok = r.status === 200 && Array.isArray(r.data) && r.data.length > 0;
    const code = r.data && r.data.code ? ` ${r.data.code}` : "";
    console.log(`  ${label} ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` → HTTP ${r.status}${code}`}`);
  }
  return out;
}

// Step 0: plain single-column FKs, as today.
await reload();
console.log("Step 0: today's single-column foreign keys");
let res = await runAll("today");
check("step 0: every current embed works", Object.values(res).every((r) => r.status === 200 && r.data.length > 0));

// Step 1: composite FKs ADDED alongside the old ones.
sql(`alter table prospects add constraint prospects_tenant_company_fk foreign key (tenant_id, company_id) references companies (tenant_id, id) on delete cascade;
     alter table prospects add constraint prospects_tenant_assignee_fk foreign key (tenant_id, assigned_to) references profiles (tenant_id, id);
     alter table contacts add constraint contacts_tenant_company_fk foreign key (tenant_id, company_id) references companies (tenant_id, id) on delete cascade;
     alter table campaign_prospects add constraint cp_tenant_prospect_fk foreign key (tenant_id, prospect_id) references prospects (tenant_id, id) on delete cascade;
     alter table activities add constraint act_tenant_prospect_fk foreign key (tenant_id, prospect_id) references prospects (tenant_id, id) on delete cascade;
     alter table activities add constraint act_tenant_user_fk foreign key (tenant_id, user_id) references profiles (tenant_id, id);
     alter table audit_logs add constraint audit_tenant_user_fk foreign key (tenant_id, user_id) references profiles (tenant_id, id);
     alter table api_usage add constraint usage_tenant_user_fk foreign key (tenant_id, user_id) references profiles (tenant_id, id);`);
await reload();
console.log("Step 1: composite keys added NEXT TO the old single-column keys");
res = await runAll("both ");
const ambiguous = Object.values(res).filter((r) => r.data && r.data.code === "PGRST201").length;
check("step 1: adding composite keys alongside the old ones makes embeds AMBIGUOUS (PGRST201)", ambiguous > 0, `${ambiguous} of ${Object.keys(QUERIES).length} embeds broke`);

// Step 2: composite keys REPLACE the single-column ones.
sql(`alter table prospects drop constraint prospects_company_id_fkey, drop constraint prospects_assigned_to_fkey;
     alter table contacts drop constraint contacts_company_id_fkey;
     alter table campaign_prospects drop constraint campaign_prospects_prospect_id_fkey;
     alter table activities drop constraint activities_prospect_id_fkey, drop constraint activities_user_id_fkey;
     alter table audit_logs drop constraint audit_logs_user_id_fkey;
     alter table api_usage drop constraint api_usage_user_id_fkey;`);
await reload();
console.log("Step 2: composite keys REPLACE the single-column keys");
res = await runAll("swap ");
check("step 2: every existing embed works again through the composite keys", Object.values(res).every((r) => r.status === 200 && r.data.length > 0));
process.exit(failed() ? 1 : 0);
