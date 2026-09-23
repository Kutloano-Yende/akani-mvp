"use client";

import { useState } from "react";
import type { Tables } from "@/types/database";

type Template = Tables<"email_templates">;

export function TemplateManager({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "", body: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create template");
        return;
      }
      setTemplates((prev) => [data.template, ...prev]);
      setForm({ name: "", subject: "", body: "" });
      setCreating(false);
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/email-templates/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      {creating ? (
        <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <label className="block">
            <span className="text-sm font-medium text-akani-text-primary">Template name</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="input mt-1"
              placeholder="e.g. Initial outreach"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-akani-text-primary">Subject</span>
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              required
              className="input mt-1"
              placeholder="e.g. Helping {{companyName}} with B-BBEE compliance"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-akani-text-primary">Body</span>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
              rows={6}
              className="input mt-1"
              placeholder={"Hi {{firstName}},\n\n..."}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-akani-gold px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save template"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-md border border-akani-card-border px-4 py-2 text-sm font-medium text-akani-text-primary hover:bg-akani-page-bg"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="rounded-md bg-akani-gold px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright"
        >
          New template
        </button>
      )}

      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-akani-card-border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-akani-text-primary">{t.name}</h3>
                <p className="mt-1 text-sm text-akani-text-secondary">{t.subject}</p>
              </div>
              <button
                onClick={() => handleDelete(t.id)}
                disabled={deleting === t.id}
                className="text-xs font-medium text-akani-error hover:opacity-80 disabled:opacity-60"
              >
                {deleting === t.id ? "Deleting…" : "Delete"}
              </button>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-akani-text-secondary">{t.body}</p>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="py-8 text-center text-sm text-akani-text-muted">No templates yet.</p>
        )}
      </div>
    </div>
  );
}
