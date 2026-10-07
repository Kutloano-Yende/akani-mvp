"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { AkaniLogo } from "@/components/akani-logo";
import { createClient } from "@/lib/supabase/client";
import { updatePassword } from "./actions";

type Result = { error: string } | void;
type LinkStatus = "checking" | "ready" | "invalid";

// An invite/recovery link is admin-minted, so GoTrue can only hand back the
// session as a URL *hash* fragment (there's no PKCE verifier anywhere for
// it to exchange a `code` against) -- the server never sees a hash, so this
// page has to read it itself and call setSession() before anything else
// can work. @supabase/ssr's browser client mirrors that session into a
// cookie, which is what the updatePassword server action below then reads.
function useLinkSession(): LinkStatus {
  const [status, setStatus] = useState<LinkStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    async function establish() {
      const supabase = createClient();
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (cancelled) return;
        if (error) {
          setStatus("invalid");
          return;
        }
        window.history.replaceState(null, "", window.location.pathname);
        setStatus("ready");
        return;
      }

      // No hash -- maybe a session already exists (e.g. a page refresh
      // after the hash was already consumed and cleared above).
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setStatus(data.session ? "ready" : "invalid");
    }
    establish();
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}

export default function UpdatePasswordPage() {
  const linkStatus = useLinkSession();
  const [state, formAction, pending] = useActionState<Result, FormData>(
    async (_prev, formData) => updatePassword(formData),
    undefined,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-akani-page-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <AkaniLogo size="sm" />
        </div>

        {linkStatus === "checking" && (
          <p className="text-center text-sm text-akani-text-muted">Checking your link…</p>
        )}

        {linkStatus === "invalid" && (
          <>
            <h1 className="mb-1 text-center text-xl font-semibold text-akani-text-primary">Link expired</h1>
            <p className="mb-6 text-center text-sm text-akani-text-muted">
              This link is invalid or has expired. Request a new one to set your password.
            </p>
            <Link
              href="/login/forgot-password"
              className="block w-full rounded-md bg-akani-navy px-4 py-2 text-center text-sm font-medium text-white shadow-sm transition hover:bg-akani-deep-blue"
            >
              Request a new link
            </Link>
          </>
        )}

        {linkStatus === "ready" && (
          <>
            <h1 className="mb-1 text-center text-xl font-semibold text-akani-text-primary">Set a new password</h1>
            <p className="mb-6 text-center text-sm text-akani-text-muted">
              Choose a password to finish setting up your Akani account.
            </p>
            <form action={formAction} className="space-y-4 rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
              {state?.error && (
                <div className="rounded-md bg-akani-error-bg px-3 py-2 text-sm text-akani-error">{state.error}</div>
              )}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-akani-text-primary">
                  New password
                </label>
                <input id="password" name="password" type="password" required minLength={8} className="input mt-1" />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-md bg-akani-navy px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-akani-deep-blue disabled:opacity-60"
              >
                {pending ? "Saving…" : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
