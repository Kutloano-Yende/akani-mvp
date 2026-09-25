"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LeadActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(next: "replied" | "closed") {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-3 whitespace-nowrap">
        {status !== "replied" && (
          <button
            onClick={() => update("replied")}
            disabled={pending}
            title="They replied, so stop the automatic emails"
            className="text-akani-gold hover:underline disabled:opacity-50"
          >
            Mark replied
          </button>
        )}
        <button
          onClick={() => update("closed")}
          disabled={pending}
          className="text-akani-text-secondary hover:underline disabled:opacity-50"
        >
          Close
        </button>
      </div>
      {error && <span className="text-xs text-akani-error">{error}</span>}
    </div>
  );
}
