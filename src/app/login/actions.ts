"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | void;

export async function signIn(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/dashboard");

  if (!email || !password) {
    return { error: "Email and password are required." };
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

  redirect(next);
}

export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") || "");
  if (!email) return { error: "Enter your email address." };

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
  });

  // Always report success, whether or not the email exists, to avoid
  // leaking which addresses are registered.
}
