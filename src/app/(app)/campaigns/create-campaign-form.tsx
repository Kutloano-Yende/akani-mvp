"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Template = { id: string; name: string };

export function CreateCampaignForm({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-akani-gold px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright"
      >
        New campaign
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, templateId: templateId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create campaign");
        return;
      }
      router.push(`/campaigns/${data.campaign.id}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-akani-card-border bg-white p-6 shadow-sm"
    >
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-akani-text-primary">Campaign name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input mt-1"
            placeholder="e.g. September Construction Campaign"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-akani-text-primary">Template (optional for now)</span>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="input mt-1"
          >
            <option value="">Choose later</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-akani-text-primary">Description</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input mt-1"
          placeholder="What's this campaign for?"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-akani-gold px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create campaign"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-akani-card-border px-4 py-2 text-sm font-medium text-akani-text-primary hover:bg-akani-page-bg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
