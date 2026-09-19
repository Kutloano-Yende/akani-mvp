"use client";

import { useActionState } from "react";
import { verifyMfaCode } from "./actions";

type Result = { error: string } | void;

export function VerifyForm({ factorId, next }: { factorId: string; next: string }) {
  const [state, formAction, pending] = useActionState<Result, FormData>(
    async (_prev, formData) => verifyMfaCode(formData),
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <input type="hidden" name="factorId" value={factorId} />
      <input type="hidden" name="next" value={next} />

      {state?.error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      )}

      <div>
        <label htmlFor="code" className="block text-sm font-medium text-slate-700">
          Authentication code
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.5em] shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          placeholder="000000"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Verifying…" : "Verify"}
      </button>

      <p className="text-center text-xs text-slate-500">
        Lost access to your authenticator? Contact an administrator to reset 2FA.
      </p>
    </form>
  );
}
