"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "@/app/(app)/actions";

// If the server never answers, don't leave people stuck on "Signing out…".
const STUCK_AFTER_MS = 10_000;

export function SignOutButton({ userName, role }: { userName: string; role: string }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  function close() {
    if (submitting) return;
    setOpen(false);
    setError(null);
  }

  // Focus the safe option when the dialog opens, hand focus back when it closes,
  // and stop the page behind from scrolling.
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Tab") {
        // Keep keyboard focus inside the dialog.
        const buttons = [cancelRef.current, confirmRef.current].filter(
          (b): b is HTMLButtonElement => !!b && !b.disabled,
        );
        if (buttons.length === 0) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // close() closes over `submitting`, so re-bind when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, submitting]);

  function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setTimeout(() => {
      // Still here: navigation didn't happen, so the request probably failed.
      setSubmitting(false);
      setError("Couldn't sign you out. Check your connection and try again.");
    }, STUCK_AFTER_MS);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white"
      >
        Sign out
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-akani-navy-dark/60"
              onClick={close}
            />
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="signout-title"
              aria-describedby="signout-body"
              className="akani-modal-in relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
            >
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-akani-navy text-akani-gold"
              >
                <LogoutIcon />
              </span>

              <h2 id="signout-title" className="mt-4 text-lg font-semibold text-akani-text-primary">
                Sign out of Akani?
              </h2>
              <p id="signout-body" className="mt-1.5 text-sm leading-relaxed text-akani-text-secondary">
                You&apos;re signed in as <strong className="font-semibold text-akani-text-primary">{userName}</strong>{" "}
                <span className="capitalize">({role})</span>. If you sign out, you&apos;ll need to sign in again to
                continue, and any unsaved changes on this page will be lost.
              </p>

              {error && (
                <p role="alert" className="mt-3 rounded-md bg-akani-error-bg px-3 py-2 text-sm text-akani-error">
                  {error}
                </p>
              )}

              <form action={signOut} onSubmit={handleSubmit} className="mt-6 flex justify-end gap-3">
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={close}
                  disabled={submitting}
                  className="rounded-md border border-akani-card-border px-4 py-2 text-sm font-medium text-akani-text-primary hover:bg-akani-page-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-akani-gold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  ref={confirmRef}
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-akani-navy px-4 py-2 text-sm font-medium text-white hover:bg-akani-deep-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-akani-gold focus-visible:ring-offset-2 disabled:opacity-70"
                >
                  {submitting ? "Signing out…" : "Sign out"}
                </button>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
