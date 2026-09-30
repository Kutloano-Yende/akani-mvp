import { createHmac, timingSafeEqual } from "node:crypto";

// Verifies a Svix-style webhook signature (used by Resend's webhooks):
// HMAC-SHA256 over "<svix-id>.<svix-timestamp>.<body>", where the secret is
// the part of the signing secret after its "whsec_" prefix, base64-decoded.
// The signature header holds one or more "v1,<base64>" entries, space-
// separated (Svix rotates keys, so more than one may be present).
export function verifySvixSignature(args: {
  id: string;
  timestamp: string;
  body: string;
  signatureHeader: string;
  secret: string;
  toleranceSeconds?: number;
}): boolean {
  const { id, timestamp, body, signatureHeader, secret, toleranceSeconds = 5 * 60 } = args;
  if (!id || !timestamp || !signatureHeader || !secret) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > toleranceSeconds) return false;

  const rawSecret = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(rawSecret, "base64");
  } catch {
    return false;
  }
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  const expectedBuf = Buffer.from(expected, "base64");

  return signatureHeader.split(" ").some((entry) => {
    const [version, sig] = entry.split(",");
    if (version !== "v1" || !sig) return false;
    let sigBuf: Buffer;
    try {
      sigBuf = Buffer.from(sig, "base64");
    } catch {
      return false;
    }
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
}
