"use client";

import { useState } from "react";

// Impossible-to-miss strip above the header while a platform admin is
// viewing as another user -- a real session swap (see
// src/app/api/admin/impersonate/route.ts), so without this banner there
// would be nothing distinguishing "my own account" from "theirs."
export function ImpersonationBanner({ targetName, tenantName }: { targetName: string; tenantName: string | null }) {
  const [exiting, setExiting] = useState(false);

  async function exit() {
    if (exiting) return;
    setExiting(true);
    try {
      const res = await fetch("/api/admin/impersonate/exit", { method: "POST" });
      const data = await res.json().catch(() => null);
      // A full navigation, not router.push: the session cookie itself just
      // changed server-side, so the client-side RSC cache must not be reused.
      window.location.href = data?.redirect ?? "/login";
    } catch {
      window.location.href = "/login";
    }
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 bg-akani-gold px-4 py-2 text-sm font-medium text-akani-navy">
      <span>
        Viewing as <strong>{targetName}</strong>
        {tenantName ? ` (${tenantName})` : ""}
      </span>
      <button
        type="button"
        onClick={exit}
        disabled={exiting}
        className="shrink-0 rounded-md bg-akani-navy px-3 py-1 text-xs font-semibold text-white transition hover:bg-akani-deep-blue disabled:opacity-50"
      >
        {exiting ? "Exiting…" : "Exit impersonation"}
      </button>
    </div>
  );
}
