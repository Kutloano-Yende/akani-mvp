"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SendCampaignButton({
  campaignId,
  pendingCount,
  hasTemplate,
}: {
  campaignId: string;
  pendingCount: number;
  hasTemplate: boolean;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send");
        return;
      }
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  const disabled = sending || pendingCount === 0 || !hasTemplate;

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        onClick={handleSend}
        disabled={disabled}
        title={!hasTemplate ? "Choose a template first" : pendingCount === 0 ? "Nothing pending" : undefined}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40"
      >
        {sending ? "Sending…" : `Send to ${pendingCount} pending`}
      </button>
    </div>
  );
}
