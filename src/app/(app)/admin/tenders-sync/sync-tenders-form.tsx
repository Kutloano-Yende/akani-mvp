"use client";

import { useState } from "react";
import type { SyncResult } from "@/lib/tenders/sync";

export function SyncTendersForm() {
  const [month, setMonth] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/tenders/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(month ? { month } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sync failed.");
        return;
      }
      setResult(data as SyncResult);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
      <label className="block">
        <span className="text-sm font-medium text-akani-text-primary">Month (optional)</span>
        <input
          type="text"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="input mt-1 max-w-[12rem]"
          placeholder="MMYYYY, e.g. 072026"
          pattern="\d{6}"
          title="Six digits: MM then YYYY, e.g. 072026 for July 2026"
        />
        <span className="mt-1 block text-xs text-akani-text-muted">
          Leave blank to sync the current month. National Treasury&apos;s bulk files can be unreliable for
          recent months -- a 502 here usually means their file for that month is currently down, not an
          app bug.
        </span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-akani-gold px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright disabled:opacity-60"
      >
        {submitting ? "Syncing…" : "Sync now"}
      </button>

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {result && (
        <div className="rounded-md bg-akani-success-bg px-4 py-3 text-sm text-akani-success">
          Synced. Fetched {result.fetched}, inserted {result.inserted}, updated {result.updated}
          {result.awardsSynced > 0 ? `, ${result.awardsSynced} award signal${result.awardsSynced === 1 ? "" : "s"}` : ""}.{" "}
          {result.unmatchedProvince > 0 &&
            `${result.unmatchedProvince} tender${result.unmatchedProvince === 1 ? "" : "s"} had no derivable province.`}
        </div>
      )}
    </form>
  );
}
