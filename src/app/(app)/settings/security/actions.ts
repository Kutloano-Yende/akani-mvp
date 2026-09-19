"use server";

import { createClient } from "@/lib/supabase/server";

export async function listFactors() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return [];
  return data.totp;
}

export async function enrollFactor() {
  const supabase = await createClient();

  // Clean up any abandoned enrollment attempts so a retry doesn't collide
  // on friendly name or hit the per-user factor cap. `totp` below is
  // pre-filtered to verified factors only — unverified ones only show up
  // in `all`.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const factor of existing?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `authenticator-${Date.now()}`,
  });
  if (error || !data) {
    return { error: error?.message ?? "Failed to start enrollment." };
  }
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function verifyFactor(factorId: string, code: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    return { error: "That code didn't work. Try again." };
  }
  return { success: true };
}

export async function unenrollFactor(factorId: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}
