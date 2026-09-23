"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export type ActionResult = { error: string } | void;

export async function signIn(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/dashboard");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  // Keyed by email rather than IP — blunts credential-stuffing against a
  // single account regardless of source. Doesn't stop a distributed attack
  // spread across many accounts, but that's a smaller, less likely risk
  // for an internal tool with a handful of known users.
  const limit = rateLimit(`signin:${email.toLowerCase()}`, 5, 5 * 60 * 1000);
  if (!limit.allowed) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Incorrect email or password." };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
    redirect(`/login/verify?next=${encodeURIComponent(next)}`);
  }

  await logAudit(supabase, { action: "SIGN_IN" });

  redirect(next);
}

export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") || "");
  if (!email) return { error: "Enter your email address." };

  const limit = rateLimit(`reset:${email.toLowerCase()}`, 3, 15 * 60 * 1000);
  if (!limit.allowed) {
    // Same generic response as success — don't leak rate-limit state to a
    // potential attacker enumerating addresses.
    return;
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
  });

  // Always report success, whether or not the email exists, to avoid
  // leaking which addresses are registered.
}
