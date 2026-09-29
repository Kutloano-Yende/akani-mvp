"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// A form's server action runs (DB writes, sometimes emails) before it
// redirects, with no built-in pending UI for that gap. This shows a spinner
// on the button that was actually clicked and disables the rest, so a form
// with several submit buttons (e.g. one per time slot) doesn't look frozen.
export function PendingSubmitButton({
  name,
  value,
  className,
  children,
}: {
  name?: string;
  value?: string;
  className: string;
  children: ReactNode;
}) {
  const { pending, data } = useFormStatus();
  const isThisButton = name && value ? data?.get(name) === value : true;
  const submitting = pending && isThisButton;

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`${className} flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {submitting && <Spinner />}
      {children}
    </button>
  );
}
