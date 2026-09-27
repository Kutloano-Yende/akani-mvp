// Helpers for talking to the LOCAL test stack (never production). No dependencies.
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";

export const AUTH = "http://127.0.0.1:54331";
export const REST = "http://127.0.0.1:54330";
const SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function signJwt(claims, secret = SECRET) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...claims });
  return `${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`;
}
export const serviceJwt = () => signJwt({ role: "service_role" });
export const anonJwt = () => signJwt({ role: "anon" });

/** Run SQL as the database superuser (fixtures and inspection only). */
export function sql(query, db = "akani_test") {
  return execFileSync(
    "docker",
    ["exec", "-i", "akani-tenancy-pg", "psql", "-U", "supabase_admin", "-h", "localhost", "-d", db, "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

/** Creates a real Auth user (as the admin API does) and returns its id. */
export async function createUser(email, password = "Test-pass-12345!", userMetadata = {}) {
  const res = await fetch(`${AUTH}/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceJwt()}`, apikey: serviceJwt() },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: userMetadata }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`createUser ${email}: ${JSON.stringify(json)}`);
  return json.id;
}

/** Password login. Returns the access token GoTrue issues, exactly as the app would receive it. */
export async function login(email, password = "Test-pass-12345!") {
  const res = await fetch(`${AUTH}/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonJwt() },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`login ${email}: ${JSON.stringify(json)}`);
  return json;
}

/** PostgREST call as a given access token (or anonymous when token is null). */
export async function rest(token, path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${REST}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token ?? anonJwt()}`,
      apikey: token ?? anonJwt(),
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

let failures = 0;
export function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}
export const failed = () => failures;

/** Like sql() but returns {ok, out, err} instead of throwing, for tests that expect an error. */
export function sqlTry(query, db = "akani_test") {
  try { return { ok: true, out: sql(query, db), err: "" }; }
  catch (e) { return { ok: false, out: "", err: String(e.stderr ?? e.message).trim().split("\n").filter((l) => /ERROR|DETAIL/.test(l)).join(" | ") }; }
}
