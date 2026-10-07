"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { getAppUrl, sendEmail, sendingUnavailable } from "@/lib/email/provider";
import { buildPasswordResetEmail } from "@/lib/auth/password-reset-email";
import { rateLimit } from "@/lib/rate-limit";
import { LAST_ACTIVITY_COOKIE } from "@/lib/idle-timeout";

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
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Incorrect email or password." };
  }

  // An admin may have suspended this account -- check before letting the
  // session stand, the same way the middleware checks on every later
  // request (see src/lib/supabase/middleware.ts).
  if (signInData.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", signInData.user.id)
      .maybeSingle();
    if (profile?.status === "suspended") {
      await supabase.auth.signOut();
      return { error: "Your account has been suspended. Contact an administrator." };
    }
  }

  // Baseline for the idle-timeout feature -- without this there'd be a gap
  // from sign-in until the first mouse move before any last_activity value
  // exists at all (see src/components/idle-timeout-manager.tsx).
  const cookieStore = await cookies();
  cookieStore.set(LAST_ACTIVITY_COOKIE, Date.now().toString(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

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

  // NEXT_PUBLIC_SITE_URL was never actually set on Vercel, so this silently
  // fell back to localhost in production. APP_URL is the one real env var
  // this app uses for its own public address (see getAppUrl).
  const h = await headers();
  const host = h.get("host");
  const origin = getAppUrl(h.get("origin") ?? (host ? `https://${host}` : "http://localhost:3000"));

  // Sent through Akani's own branded pipeline, same as invites, instead of
  // Supabase's default-styled reset email. generateLink needs the
  // service-role key and errors for an email with no account; both cases
  // are swallowed here so this never reveals whether an address is
  // registered -- the caller always shows the same generic message either way.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        // Straight to the page, not via /auth/callback: see the comment on
        // the equivalent invite link in invite-user.ts for why.
        options: { redirectTo: `${origin}/auth/update-password` },
      });
      if (data?.properties?.action_link && !sendingUnavailable()) {
        const resetEmail = buildPasswordResetEmail(data.properties.action_link, origin);
        await sendEmail({ to: email, subject: resetEmail.subject, html: resetEmail.html, text: resetEmail.text });
      }
    } catch (err) {
      console.error("Password reset email failed", err);
    }
  } else {
    console.error("Password reset requested but SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  // Always report success, whether or not the email exists, to avoid
  // leaking which addresses are registered.
}
