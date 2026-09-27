// E2: do composite (tenant_id, x) foreign keys stop cross-tenant links, and how do they behave for
// NULLs, deletes and validation? Uses throwaway tables in schema e2; touches nothing else.
import { sql, sqlTry, check, failed } from "../harness/lib.mjs";

sql(`drop schema if exists e2 cascade; create schema e2;
 create table e2.parent (tenant_id uuid not null, id uuid not null default gen_random_uuid(), primary key (id), unique (tenant_id, id));
 create table e2.child_cascade (tenant_id uuid not null, id uuid default gen_random_uuid() primary key, parent_id uuid not null,
   foreign key (tenant_id, parent_id) references e2.parent (tenant_id, id) on delete cascade);
 create table e2.child_optional (tenant_id uuid not null, id uuid default gen_random_uuid() primary key, parent_id uuid,
   foreign key (tenant_id, parent_id) references e2.parent (tenant_id, id));
 create table e2.child_setnull_naive (tenant_id uuid not null, id uuid default gen_random_uuid() primary key, parent_id uuid,
   foreign key (tenant_id, parent_id) references e2.parent (tenant_id, id) on delete set null);
 create table e2.child_setnull_cols (tenant_id uuid not null, id uuid default gen_random_uuid() primary key, parent_id uuid,
   foreign key (tenant_id, parent_id) references e2.parent (tenant_id, id) on delete set null (parent_id));`);

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const pA = sql(`insert into e2.parent (tenant_id) values ('${A}') returning id`).split("\n")[0];
const pB = sql(`insert into e2.parent (tenant_id) values ('${B}') returning id`).split("\n")[0];

let r = sqlTry(`insert into e2.child_cascade (tenant_id, parent_id) values ('${A}','${pA}')`);
check("same-tenant child is accepted", r.ok, r.err);
r = sqlTry(`insert into e2.child_cascade (tenant_id, parent_id) values ('${A}','${pB}')`);
check("child of tenant A pointing at tenant B's parent is REJECTED", !r.ok && /23503|violates foreign key/.test(r.err), r.err);
r = sqlTry(`insert into e2.child_cascade (tenant_id, parent_id) values ('${A}','${crypto.randomUUID()}')`);
const nonexistentMsg = r.err;
r = sqlTry(`insert into e2.child_cascade (tenant_id, parent_id) values ('${A}','${pB}')`);
check("error text is identical for 'exists in another tenant' and 'does not exist' (no existence leak)",
  r.err.replace(/\(tenant_id, parent_id\)=\([^)]*\)/, "") === nonexistentMsg.replace(/\(tenant_id, parent_id\)=\([^)]*\)/, ""),
  "compared with ids masked");
r = sqlTry(`insert into e2.child_optional (tenant_id, parent_id) values ('${A}', null)`);
check("optional link left NULL is allowed (unassigned prospect case)", r.ok, r.err);
r = sqlTry(`insert into e2.child_optional (tenant_id, parent_id) values ('${A}','${pB}')`);
check("optional link set to another tenant's parent is REJECTED (assigned_to case)", !r.ok, r.err);

sql(`insert into e2.child_setnull_naive (tenant_id, parent_id) values ('${A}','${pA}')`);
r = sqlTry(`delete from e2.parent where id='${pA}'`);
// pA still referenced by child_cascade (cascade) and naive set-null child
check("ON DELETE SET NULL on a composite key WITHOUT a column list fails (it tries to null tenant_id)",
  !r.ok && /null value in column "tenant_id"/.test(r.err), r.err);
sql(`delete from e2.child_setnull_naive`);
sql(`insert into e2.child_setnull_cols (tenant_id, parent_id) values ('${A}','${pA}')`);
r = sqlTry(`delete from e2.parent where id='${pA}'`);
check("ON DELETE SET NULL (parent_id) column-list form works on PG17", r.ok, r.err);
check("  ...and leaves tenant_id intact, nulls only parent_id",
  sql(`select tenant_id::text||'/'||coalesce(parent_id::text,'NULL') from e2.child_setnull_cols`) === `${A}/NULL`);
check("ON DELETE CASCADE removes the tenant's children", sql(`select count(*) from e2.child_cascade where parent_id='${pA}'`) === "0");

// Retrofitting onto existing data: NOT VALID first, then VALIDATE; a bad row must block validation.
sql(`create table e2.legacy (tenant_id uuid not null, id uuid default gen_random_uuid() primary key, parent_id uuid not null);
     insert into e2.legacy (tenant_id, parent_id) values ('${A}','${pB}')`);
r = sqlTry(`alter table e2.legacy add constraint legacy_fk foreign key (tenant_id, parent_id) references e2.parent (tenant_id, id) not valid`);
check("adding the constraint NOT VALID succeeds even with a bad existing row", r.ok, r.err);
r = sqlTry(`alter table e2.legacy validate constraint legacy_fk`);
check("VALIDATE fails while a cross-tenant row exists (so the migration can't silently pass)", !r.ok, r.err);
sql(`drop schema e2 cascade`);
process.exit(failed() ? 1 : 0);
