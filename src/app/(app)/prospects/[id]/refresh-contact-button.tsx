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
    <div className="mt-3 rounded-md bg-akani-warning-bg p-3">
      <p className="text-xs font-medium text-akani-warning">
        Missing contact details — this company may just not have been looked up yet.
      </p>
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="mt-2 w-full rounded-md bg-akani-gold px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-akani-gold-bright disabled:opacity-60"
      >
        {loading ? "Checking…" : "Refresh contact details"}
      </button>
      {result && (
        <p className="mt-2 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-akani-text-primary">
          {result}
        </p>
      )}
      {error && (
        <p className="mt-2 rounded-md bg-akani-error-bg px-2.5 py-1.5 text-xs font-medium text-akani-error">
          {error}
        </p>
      )}
    </div>
  );
}
