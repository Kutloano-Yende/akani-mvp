"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "@/app/(app)/actions";
import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS } from "@/lib/idle-timeout";

const ACTIVITY_EVENTS = ["mousemove", "keydown", "mousedown", "scroll", "touchstart"] as const;
// Don't send a heartbeat on every pixel of mouse movement -- at most once
// this often, no matter how much genuine activity happens in between.
const HEARTBEAT_MIN_INTERVAL_MS = 60 * 1000;
const TICK_MS = 1000;

function sendHeartbeat() {
  fetch("/api/auth/heartbeat", { method: "POST" }).catch(() => {
    // A dropped heartbeat just means the server-side backstop (middleware)
    // might catch this a little later than it otherwise would -- not worth
    // surfacing to the person using the app.
  });
}

export function IdleTimeoutManager() {
  const [warning, setWarning] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const lastHeartbeatRef = useRef(Date.now());
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerWasWarningRef = useRef(false);

  useEffect(() => {
    function onActivity() {
      const now = Date.now();
      lastActivityRef.current = now;
      // Activity while the warning is showing means "stay signed in" was
      // implied by the person still being there -- dismiss it and extend.
      setWarning(false);
      if (now - lastHeartbeatRef.current >= HEARTBEAT_MIN_INTERVAL_MS) {
        lastHeartbeatRef.current = now;
        sendHeartbeat();
      }
    }
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= IDLE_TIMEOUT_MS) {
        signOut();
        return;
      }
      setWarning(idleFor >= IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!warning) {
      triggerWasWarningRef.current = false;
      return;
    }
    triggerWasWarningRef.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [warning]);

  useEffect(() => {
    if (!warning) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        staySignedIn();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [warning]);

  function staySignedIn() {
    lastActivityRef.current = Date.now();
    lastHeartbeatRef.current = Date.now();
    sendHeartbeat();
    setWarning(false);
  }

  if (!warning) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-akani-navy-dark/60" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-timeout-title"
        aria-describedby="idle-timeout-body"
        className="akani-modal-in relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
      >
        <span
          aria-hidden="true"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-akani-navy text-akani-gold"
        >
          <ClockIcon />
        </span>

        <h2 id="idle-timeout-title" className="mt-4 text-lg font-semibold text-akani-text-primary">
          Still there?
        </h2>
        <p id="idle-timeout-body" className="mt-1.5 text-sm leading-relaxed text-akani-text-secondary">
          You&apos;ve been inactive for a while. For security, you&apos;ll be signed out soon unless you&apos;d like
          to stay signed in.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-md border border-akani-card-border px-4 py-2 text-sm font-medium text-akani-text-primary hover:bg-akani-page-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-akani-gold"
          >
            Sign out now
          </button>
          <button
            ref={cancelRef}
            type="button"
            onClick={staySignedIn}
            className="rounded-md bg-akani-navy px-4 py-2 text-sm font-medium text-white hover:bg-akani-deep-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-akani-gold focus-visible:ring-offset-2"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
