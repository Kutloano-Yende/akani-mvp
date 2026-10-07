"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AkaniLogo } from "@/components/akani-logo";
import { requestPasswordReset, type ActionResult } from "../actions";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => {
      await requestPasswordReset(formData);
      return { error: "" };
    },
    undefined,
  );

  const submitted = state !== undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-akani-page-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <AkaniLogo size="sm" />
        </div>
        <h1 className="mb-1 text-center text-xl font-semibold text-akani-text-primary">Reset your password</h1>
        <p className="mb-6 text-center text-sm text-akani-text-muted">
          We&apos;ll email you a link to reset your password.
        </p>

        {submitted ? (
          <div className="rounded-md bg-akani-success-bg px-3 py-3 text-sm text-akani-success">
            If an account exists for that email, a reset link is on its way.
          </div>
        ) : (
          <form action={formAction} className="space-y-4 rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-akani-text-primary">
                Email
              </label>
              <input id="email" name="email" type="email" required className="input mt-1" />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-md bg-akani-navy px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-akani-deep-blue disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link href="/login" className="mt-4 block text-center text-sm font-medium text-akani-gold hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
