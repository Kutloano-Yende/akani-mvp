"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AvailableProspect = { id: string; companyName: string; industry: string | null };

export function CampaignProspectPicker({
  campaignId,
  available,
}: {
  campaignId: string;
  available: AvailableProspect[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setPending(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/prospects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectIds: Array.from(selected) }),
      });
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  if (available.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No eligible prospects (qualified, contacted, or interested) to add right now.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
        {available.map((p) => (
          <label
            key={p.id}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={selected.has(p.id)}
              onChange={() => toggle(p.id)}
              className="rounded border-slate-300"
            />
            <span className="font-medium text-slate-900">{p.companyName}</span>
            <span className="text-slate-400">{p.industry}</span>
          </label>
        ))}
      </div>
      <button
        onClick={handleAdd}
        disabled={selected.size === 0 || pending}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "Adding…" : `Add ${selected.size || ""} selected`.trim()}
      </button>
    </div>
  );
}
