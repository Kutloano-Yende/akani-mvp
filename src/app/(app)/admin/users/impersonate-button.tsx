"use client";

import { useState } from "react";

export function ImpersonateButton({ userId, name }: { userId: string; name: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (loading) return;
    if (!window.confirm(`Impersonate ${name}? You'll act as them until you exit.`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to start impersonation");
      // A full navigation: the session cookie just swapped to the target
      // user's, so the client-side RSC cache (built for the admin) must not be reused.
      window.location.href = data.redirect;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start impersonation");
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="rounded-md border border-akani-card-border px-3 py-1 text-xs font-medium text-akani-text-primary transition hover:bg-akani-page-bg disabled:opacity-50"
      >
        {loading ? "Starting…" : "Impersonate"}
      </button>
      {error && <p className="mt-1 text-xs text-akani-error">{error}</p>}
    </div>
  );
}
