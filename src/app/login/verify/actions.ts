"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

  if (error) {
    return { error: "That code didn't work. Try again." };
  }

  redirect(next);
}
