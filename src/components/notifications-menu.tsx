"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Notification = { id: string; tone: "warning" | "urgent"; text: string; href: string };

export function NotificationsMenu() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) setItems((await res.json()).notifications);
    } catch {
      // A failed refresh just leaves the previous list in place.
    }
  }

  useEffect(() => {
    const first = setTimeout(load, 0);
    const interval = setInterval(load, 5 * 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const count = items?.length ?? 0;

  return (
    <div ref={containerRef} data-tour="notifications" className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={count ? `Notifications, ${count} need attention` : "Notifications"}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-akani-text-secondary hover:bg-akani-page-bg"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-akani-gold px-1 text-[10px] font-bold text-akani-navy">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-lg border border-akani-card-border bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
          <p className="border-b border-akani-card-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-akani-text-muted">
            Needs attention
          </p>
          {items === null ? (
            <p className="px-4 py-3 text-sm text-akani-text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-akani-text-muted">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2.5 px-4 py-2.5 text-sm text-akani-text-primary hover:bg-akani-page-bg"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        n.tone === "urgent" ? "bg-akani-error" : "bg-akani-gold"
                      }`}
                    />
                    {n.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
