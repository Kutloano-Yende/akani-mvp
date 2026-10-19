"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SaveTenderButton({
  tenderId,
  initialSaved,
  compact = false,
}: {
  tenderId: string;
  initialSaved: boolean;
  /** Smaller, row-scale rendering for the Opportunities list table. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenders/${tenderId}/save`, { method: saved ? "DELETE" : "POST" });
      if (res.ok) {
        setSaved(!saved);
        router.refresh();
      } else {
        setError((await res.json()).error ?? "Failed to update");
      }
    } finally {
      setPending(false);
    }
  }

  const baseClass = compact
    ? "rounded-md border border-akani-card-border px-2.5 py-1 text-xs font-medium hover:bg-akani-page-bg disabled:opacity-60"
    : "w-full rounded-md px-4 py-2 text-sm font-medium shadow-sm disabled:opacity-60";

  return (
    <div>
      {error && !compact && <p className="mb-1 text-sm text-akani-error">{error}</p>}
      <button
        onClick={toggle}
        disabled={pending}
        title={error ?? undefined}
        className={`${baseClass} ${
          saved
            ? "border border-akani-card-border text-akani-text-primary hover:bg-akani-page-bg"
            : "bg-akani-gold text-white hover:bg-akani-gold-bright"
        }`}
      >
        {pending ? "Saving…" : saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
