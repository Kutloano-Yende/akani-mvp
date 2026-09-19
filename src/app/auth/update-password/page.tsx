"use client";

import { useActionState } from "react";
import { updatePassword } from "./actions";

type Result = { error: string } | void;

export default function UpdatePasswordPage() {
  const [state, formAction, pending] = useActionState<Result, FormData>(
    async (_prev, formData) => updatePassword(formData),
    undefined,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-xl font-semibold text-slate-900">Set a new password</h1>
        <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {state?.error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
          )}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
