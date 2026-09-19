"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Enums } from "@/types/database";

type Status = Enums<"prospect_status">;

const NEXT_STAGE: Partial<Record<Status, { status: Status; label: string }>> = {
  identified: { status: "qualified", label: "Qualify prospect" },
  qualified: { status: "contacted", label: "Mark contacted" },
  contacted: { status: "interested", label: "Mark interested" },
  interested: { status: "application", label: "Start application" },
  application: { status: "won", label: "Mark won" },
};

export function StatusActions({ prospectId, status }: { prospectId: string; status: Status }) {
  const router = useRouter();
  const [pending, setPending] = useState<Status | null>(null);

  async function updateStatus(newStatus: Status) {
    setPending(newStatus);
    try {
      const res = await fetch(`/api/prospects/${prospectId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) router.refresh();
    } finally {
      setPending(null);
    }
  }

  const next = NEXT_STAGE[status];
  const isClosed = status === "won" || status === "lost";

  return (
    <div className="space-y-2">
      {next && (
        <button
          onClick={() => updateStatus(next.status)}
          disabled={pending !== null}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending === next.status ? "Updating…" : next.label}
        </button>
      )}
      {!isClosed && (
        <button
          onClick={() => updateStatus("lost")}
          disabled={pending !== null}
          className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {pending === "lost" ? "Updating…" : "Mark lost"}
        </button>
      )}
      {isClosed && (
        <p className="text-center text-sm text-slate-500">
          This prospect is {status === "won" ? "a paying client" : "closed as lost"}.
        </p>
      )}
    </div>
  );
}
