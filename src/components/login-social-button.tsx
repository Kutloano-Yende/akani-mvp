"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Provider = "google" | "azure";

/**
 * Real Supabase OAuth sign-in (google -> "google", Microsoft -> "azure").
 * Will redirect correctly once the provider is enabled with credentials in
 * Supabase Auth settings; until then Supabase returns an error, which is
 * shown inline rather than faking a successful sign-in.
 */
export function LoginSocialButton({
  provider,
  label,
  icon,
  disabled = false,
  disabledHint,
}: {
  provider?: Provider;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!provider || disabled) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setPending(false);
      setError("This sign-in method isn't set up yet.");
    }
    // On success Supabase navigates the browser away to the provider —
    // there's no further local state to update.
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        aria-disabled={disabled || pending}
        title={disabled ? disabledHint : undefined}
        className="login-social-btn flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-akani-border bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {icon}
        {pending ? "Redirecting…" : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {disabled && disabledHint && (
        <p className="login-subtext mt-1 text-xs text-akani-muted">{disabledHint}</p>
      )}
    </div>
  );
}
