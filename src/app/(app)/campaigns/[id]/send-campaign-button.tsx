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
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send");
        return;
      }
      const parts = [`${data.mode === "live" ? "Sent" : "Simulated sending"} to ${data.sent}`];
      if (data.suppressed > 0) parts.push(`skipped ${data.suppressed} on the suppression list`);
      if (data.noEmail > 0) parts.push(`${data.noEmail} have no email address`);
      if (data.failed > 0) parts.push(`${data.failed} failed (${data.firstError})`);
      if (data.remaining > 0) parts.push(`${data.remaining} still pending, send again to continue`);
      if (parts.length > 1 || data.failed > 0) setNotice(parts.join(". ") + ".");
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  const disabled = sending || pendingCount === 0 || !hasTemplate;

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-akani-error">{error}</span>}
      {notice && <span className="text-xs text-akani-warning">{notice}</span>}
      <button
        onClick={handleSend}
        disabled={disabled}
        title={!hasTemplate ? "Choose a template first" : pendingCount === 0 ? "Nothing pending" : undefined}
        className="rounded-md bg-akani-gold px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright disabled:opacity-40"
      >
        {sending ? "Sending…" : `Send to ${pendingCount} pending`}
      </button>
    </div>
  );
}
