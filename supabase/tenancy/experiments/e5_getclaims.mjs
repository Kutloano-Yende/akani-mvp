// E5: getClaims() vs getUser(). Production signs tokens with an asymmetric ES256 key (verified from its public
// JWKS), where getClaims() checks the signature locally. What does that buy us, and what does it cost?
import { GoTrueClient } from "@supabase/auth-js";
import { webcrypto as crypto } from "node:crypto";
import { createUser, login, check, failed, AUTH, anonJwt } from "../harness/lib.mjs";

const client = (url) => new GoTrueClient({ url, headers: { apikey: anonJwt() }, autoRefreshToken: false, persistSession: false });
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");

// --- Symmetric (local GoTrue, HS256): the library must ask the server
await createUser("e5-user@test.local");
const { access_token } = await login("e5-user@test.local");
let r = await client(AUTH).getClaims(access_token);
check("HS256: getClaims returns claims (via a server round-trip)", !r.error && !!r.data?.claims?.sub, r.error?.message);
check("  claims carry sub, role, aal, app_metadata, user_metadata",
  ["sub", "role", "aal", "app_metadata", "user_metadata"].every((k) => k in (r.data?.claims ?? {})));
const tampered = access_token.split(".").map((p, i) => (i === 1 ? b64({ ...JSON.parse(Buffer.from(p, "base64url")), role: "service_role" }) : p)).join(".");
r = await client(AUTH).getClaims(tampered);
check("HS256: tampered token is rejected", !!r.error);

// --- Asymmetric (production style, ES256), verified LOCALLY with a supplied key set and NO reachable server
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid: "test-key", alg: "ES256", use: "sig", key_ops: ["verify"] };
async function es256(claims, key = privateKey, kid = "test-key") {
  const head = b64({ alg: "ES256", typ: "JWT", kid });
  const body = b64({ aud: "authenticated", role: "authenticated", sub: crypto.randomUUID(), iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...claims });
  const sig = Buffer.from(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, Buffer.from(`${head}.${body}`))).toString("base64url");
  return `${head}.${body}.${sig}`;
}
const offline = client("http://127.0.0.1:1"); // nothing listens here: any network call would fail
const good = await es256({});
r = await offline.getClaims(good, { jwks: { keys: [jwk] } });
check("ES256: valid token verifies with NO network (server unreachable)", !r.error && !!r.data?.claims?.sub, r.error?.message);
r = await offline.getClaims(await es256({ exp: Math.floor(Date.now() / 1000) - 60 }), { jwks: { keys: [jwk] } });
check("ES256: expired token is rejected", !!r.error, r.error?.message);
const other = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
r = await offline.getClaims(await es256({}, other.privateKey), { jwks: { keys: [jwk] } });
check("ES256: token signed by a different key is rejected", !!r.error, r.error?.message);
const [h, p, s] = good.split(".");
r = await offline.getClaims(`${h}.${b64({ ...JSON.parse(Buffer.from(p, "base64url")), role: "service_role" })}.${s}`, { jwks: { keys: [jwk] } });
check("ES256: tampered payload is rejected", !!r.error, r.error?.message);

// --- The cost: revocation. getUser() asks the server; a locally verified token cannot know it was revoked.
const fresh = (await login("e5-user@test.local")).access_token;
await fetch(`${AUTH}/logout?scope=global`, { method: "POST", headers: { apikey: anonJwt(), Authorization: `Bearer ${fresh}` } });
r = await client(AUTH).getUser(fresh);
check("after sign-out the server-checked getUser() REJECTS the old token", !!r.error, r.error?.message);
check("...but an unexpired asymmetric token still verifies offline (getClaims cannot see the sign-out)",
  !(await offline.getClaims(good, { jwks: { keys: [jwk] } })).error);
process.exit(failed() ? 1 : 0);
