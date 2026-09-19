"use client";

import { useActionState } from "react";
import Link from "next/link";
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Reset your password</h1>
        <p className="mb-6 text-sm text-slate-500">
          We&apos;ll email you a link to reset your password.
        </p>

        {submitted ? (
          <div className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            If an account exists for that email, a reset link is on its way.
          </div>
        ) : (
          <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link href="/login" className="mt-4 block text-center text-sm font-medium text-emerald-700 hover:text-emerald-800">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
