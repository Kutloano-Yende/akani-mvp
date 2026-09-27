// E4: (a) can a user edit their own user_metadata / app_metadata? (b) what can an outsider do when public
// sign-up is ON (production's setting today) against TODAY's policies? (c) does switching sign-up OFF
// break admin invites (which the app uses)? Runs only against the local stack.
import { execFileSync } from "node:child_process";
import { createUser, login, rest, sql, check, failed, AUTH, anonJwt, serviceJwt } from "../harness/lib.mjs";

const MAIL = "http://127.0.0.1:54332";
const hdr = (tok) => ({ "Content-Type": "application/json", apikey: anonJwt(), Authorization: `Bearer ${tok ?? anonJwt()}` });
const mails = async () => (await (await fetch(`${MAIL}/api/v1/messages`)).json()).messages ?? [];
const clearMail = () => fetch(`${MAIL}/api/v1/messages`, { method: "DELETE" });
async function linkFromMail(to) {
  for (let i = 0; i < 20; i++) {
    const m = (await mails()).find((x) => x.To.some((t) => t.Address === to));
    if (m) {
      const full = await (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json();
      const link = (full.Text + " " + full.HTML).match(/https?:\/\/[^\s"'<>]+\/verify[^\s"'<>]+/)?.[0];
      if (link) return link.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}
const reset = async (env) => {
  execFileSync("bash", ["supabase/tenancy/harness/reset.sh"], { env: { ...process.env, ...env }, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 4000)); // Docker's port proxy can reset the very first connection
};

// ---------- Part A: public sign-up ON, as production is today ----------
await reset({ TEN_DISABLE_SIGNUP: "false" });
await clearMail();
let r = await fetch(`${AUTH}/signup`, {
  method: "POST", headers: hdr(),
  body: JSON.stringify({ email: "outsider@test.local", password: "Outsider-pass-123!", data: { name: "Outsider", role: "admin", tenant_id: "evil" } }),
});
check("A1: anyone holding the public anon key can self-register", r.status === 200, `HTTP ${r.status}`);
const link = await linkFromMail("outsider@test.local");
check("A2: a confirmation email is sent (they need a real inbox, nothing more)", !!link);
if (link) await fetch(link, { redirect: "manual" });
const outsider = await login("outsider@test.local", "Outsider-pass-123!");
const tok = outsider.access_token;
const oid = outsider.user.id;
check("A3: profile created by trigger ignores 'role' in metadata", sql(`select role from profiles where id='${oid}'`) === "sales");

const leaks = {};
for (const t of ["companies", "contacts", "prospects", "activities", "campaigns", "email_templates", "profiles"]) {
  const x = await rest(tok, `${t}?select=id`);
  leaks[t] = Array.isArray(x.data) ? x.data.length : `HTTP ${x.status}`;
}
console.log("   rows an outsider can read with TODAY's policies:", JSON.stringify(leaks));
check("A4: TODAY'S policies let a self-registered outsider read business data (LEAK CONFIRMED on the local replica)",
  leaks.companies > 0 && leaks.contacts > 0 && leaks.prospects > 0);

const upd = await fetch(`${AUTH}/user`, { method: "PUT", headers: hdr(tok), body: JSON.stringify({ data: { tenant_id: "evil", role: "tenant_admin" } }) });
const after = await (await fetch(`${AUTH}/user`, { headers: hdr(tok) })).json();
check("A5: a user CAN rewrite their own user_metadata (so it must never carry tenant or role)",
  upd.status === 200 && after.user_metadata?.tenant_id === "evil" && after.user_metadata?.role === "tenant_admin");
await fetch(`${AUTH}/user`, { method: "PUT", headers: hdr(tok), body: JSON.stringify({ app_metadata: { tenant_id: "evil" } }) });
const after2 = await (await fetch(`${AUTH}/user`, { headers: hdr(tok) })).json();
check("A6: a user can NOT write app_metadata", after2.app_metadata?.tenant_id === undefined, JSON.stringify(after2.app_metadata));

// ---------- Part B: public sign-up OFF ----------
await reset({ TEN_DISABLE_SIGNUP: "true" });
await clearMail();
r = await fetch(`${AUTH}/signup`, { method: "POST", headers: hdr(), body: JSON.stringify({ email: "outsider2@test.local", password: "Outsider-pass-123!" }) });
check("B1: with sign-up off, public self-registration is refused", r.status >= 400, `HTTP ${r.status} ${(await r.text()).slice(0, 90)}`);
r = await fetch(`${AUTH}/invite`, { method: "POST", headers: { "Content-Type": "application/json", apikey: serviceJwt(), Authorization: `Bearer ${serviceJwt()}` }, body: JSON.stringify({ email: "invitee@test.local", data: { name: "Invitee" } }) });
check("B2: with sign-up off, the admin invite the app uses (inviteUserByEmail) STILL WORKS", r.status === 200, `HTTP ${r.status}`);
check("B3: ...and the invitation email is delivered", !!(await linkFromMail("invitee@test.local")));
const id = await createUser("admin-created@test.local");
check("B4: with sign-up off, admin-created users still work", !!id);
process.exit(failed() ? 1 : 0);
