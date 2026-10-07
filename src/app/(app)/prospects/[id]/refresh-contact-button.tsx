"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefreshContactButton({ prospectId }: { prospectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/prospects/${prospectId}/refresh-contact`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to refresh contact details");
      setResult(data.email || data.phone ? "Found contact details." : "No contact details found this time.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh contact details");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 border-t border-akani-card-border pt-3">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="w-full rounded-md border border-akani-card-border px-3 py-1.5 text-xs font-medium text-akani-text-primary transition hover:bg-akani-page-bg disabled:opacity-50"
      >
        {loading ? "Checking…" : "Refresh contact details"}
      </button>
      {result && <p className="mt-1 text-xs text-akani-text-muted">{result}</p>}
      {error && <p className="mt-1 text-xs text-akani-error">{error}</p>}
    </div>
  );
}
