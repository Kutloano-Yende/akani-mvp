"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Status = "idle" | "sending" | "sent" | "error";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (status !== "sent") return;
    const t = setTimeout(() => {
      setOpen(false);
      setStatus("idle");
      setMessage("");
    }, 1500);
    return () => clearTimeout(t);
  }, [status]);

  async function submit() {
    const text = message.trim();
    if (!text || status === "sending") return;
    setError(null);
    setStatus("sending");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, pagePath: pathname }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }
      setStatus("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close feedback" : "Send feedback"}
        aria-expanded={open}
        className="fixed bottom-5 right-20 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-akani-gold text-akani-navy shadow-lg transition hover:bg-akani-gold-bright"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.95-6.95-2.12 2.12M8.17 15.83l-2.12 2.12m0-11.9 2.12 2.12m7.66 7.66 2.12 2.12"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 bottom-20 z-40 flex flex-col overflow-hidden rounded-xl border border-akani-card-border bg-white shadow-2xl sm:inset-x-auto sm:bottom-20 sm:right-5 sm:w-96">
          <div className="flex shrink-0 items-center justify-between border-b border-akani-card-border px-4 py-3">
            <p className="text-sm font-semibold text-akani-text-primary">Send feedback</p>
            <p className="text-xs text-akani-text-muted">Found a bug? Have an idea?</p>
          </div>

          <div className="space-y-3 px-4 py-3">
            {status === "sent" ? (
              <p className="py-4 text-center text-sm text-akani-text-secondary">Thanks — we got it.</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
                className="space-y-3"
              >
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="What's working, what's not, what would help…"
                  className="input min-h-[7rem] resize-none"
                />
                {error && <p className="text-sm text-akani-error">{error}</p>}
                <button
                  type="submit"
                  disabled={status === "sending" || !message.trim()}
                  className="w-full rounded-md bg-akani-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-akani-deep-blue disabled:opacity-50"
                >
                  {status === "sending" ? "Sending…" : "Send feedback"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
