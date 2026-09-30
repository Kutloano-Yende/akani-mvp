import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySvixSignature } from "./svix";

const rawSecret = Buffer.from("test-signing-key").toString("base64");
const secret = `whsec_${rawSecret}`;
const id = "msg_test123";
const body = JSON.stringify({ hello: "world" });

function sign(idToSign: string, timestamp: string, bodyToSign: string, rawSecretBase64 = rawSecret): string {
  const key = Buffer.from(rawSecretBase64, "base64");
  const digest = createHmac("sha256", key).update(`${idToSign}.${timestamp}.${bodyToSign}`).digest("base64");
  return `v1,${digest}`;
}

describe("verifySvixSignature", () => {
  it("accepts a correctly signed payload", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signatureHeader = sign(id, timestamp, body);
    expect(verifySvixSignature({ id, timestamp, body, signatureHeader, secret })).toBe(true);
  });

  it("accepts when one of several space-separated signatures matches (key rotation)", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signatureHeader = `v1,bm90dGhlcmlnaHRvbmU= ${sign(id, timestamp, body)}`;
    expect(verifySvixSignature({ id, timestamp, body, signatureHeader, secret })).toBe(true);
  });

  it("rejects a tampered body", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signatureHeader = sign(id, timestamp, body);
    expect(verifySvixSignature({ id, timestamp, body: body + "x", signatureHeader, secret })).toBe(false);
  });

  it("rejects the wrong secret", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signatureHeader = sign(id, timestamp, body);
    expect(verifySvixSignature({ id, timestamp, body, signatureHeader, secret: "whsec_d3Jvbmc=" })).toBe(false);
  });

  it("rejects a stale timestamp", () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 10 * 60);
    const signatureHeader = sign(id, timestamp, body);
    expect(verifySvixSignature({ id, timestamp, body, signatureHeader, secret })).toBe(false);
  });

  it("rejects a missing or malformed signature header", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(verifySvixSignature({ id, timestamp, body, signatureHeader: "", secret })).toBe(false);
    expect(verifySvixSignature({ id, timestamp, body, signatureHeader: "garbage", secret })).toBe(false);
    expect(verifySvixSignature({ id, timestamp, body, signatureHeader: "v2,abc", secret })).toBe(false);
  });

  it("rejects when the id used to sign doesn't match", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signatureHeader = sign("a-different-id", timestamp, body);
    expect(verifySvixSignature({ id, timestamp, body, signatureHeader, secret })).toBe(false);
  });
});
