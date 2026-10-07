"use client";

import { useActionState } from "react";
import { AkaniLogo } from "@/components/akani-logo";
import { updatePassword } from "./actions";

type Result = { error: string } | void;

export default function UpdatePasswordPage() {
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
      </div>
    </div>
  );
}
