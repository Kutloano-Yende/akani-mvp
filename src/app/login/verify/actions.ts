"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export async function listMfaFactors() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return [];
  return data.totp.filter((f) => f.status === "verified");
}

export async function verifyMfaCode(formData: FormData) {
  const factorId = String(formData.get("factorId") || "");
  const code = String(formData.get("code") || "");
  const next = String(formData.get("next") || "/dashboard");

  if (!factorId || code.length < 6) {
    return { error: "Enter the 6-digit code from your authenticator app." };
  }

  // A 6-digit TOTP code is brute-forceable in principle (1M combinations);
  // this makes that impractical without blocking a legitimate user who
  // mistypes a couple of times.
  const limit = rateLimit(`mfa-verify:${factorId}`, 8, 5 * 60 * 1000);
  if (!limit.allowed) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

  if (error) {
    return { error: "That code didn't work. Try again." };
  }

  await logAudit(supabase, { action: "SIGN_IN", metadata: { mfa: true } });

  redirect(next);
}
