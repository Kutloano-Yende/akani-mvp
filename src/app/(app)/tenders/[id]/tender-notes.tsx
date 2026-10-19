"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TenderNotes({ tenderId, initialNotes }: { tenderId: string; initialNotes: string | null }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/tenders/${tenderId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError((await res.json()).error ?? "Failed to save");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-akani-error">{error}</p>}
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        rows={4}
        placeholder="e.g. Good fit for our Gauteng-based construction clients — follow up with the buyer before closing"
        className="input"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-md bg-akani-gold px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save note"}
        </button>
        {saved && !pending && <span className="text-sm text-akani-success">Saved</span>}
      </div>
    </div>
  );
}
