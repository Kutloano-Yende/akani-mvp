"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Enums } from "@/types/database";

type Status = Enums<"prospect_status">;

type NoteTransition = {
  status: Status;
  label: string;
  prompt: string;
  placeholder: string;
  confirmLabel: string;
  endpoint: (prospectId: string) => string;
  body: (note: string) => Record<string, unknown>;
};

const NOTE_TRANSITIONS: Partial<Record<Status, NoteTransition>> = {
  identified: {
    status: "qualified",
    label: "Qualify prospect",
    prompt: "Why does this prospect qualify?",
    placeholder: "e.g. Confirmed construction sector, 80+ employees, decision-maker contact on file",
    confirmLabel: "Confirm qualification",
    endpoint: (id) => `/api/prospects/${id}/status`,
    body: (note) => ({ status: "qualified", note }),
  },
  interested: {
    status: "application",
    label: "Start application",
    prompt: "Application notes (optional)",
    placeholder: "e.g. Application submitted via portal, reference #12345",
    confirmLabel: "Start application",
    endpoint: (id) => `/api/prospects/${id}/application`,
    body: (note) => ({ notes: note }),
  },
  application: {
    status: "won",
    label: "Mark won",
    prompt: "How did this become a paying client? (optional)",
    placeholder: "e.g. Signed engagement letter 2026-09-19",
    confirmLabel: "Confirm paying client",
    endpoint: () => `/api/conversions/report`,
    body: (note) => ({ notes: note }),
  },
};

const SIMPLE_NEXT: Partial<Record<Status, { status: Status; label: string }>> = {
  qualified: { status: "contacted", label: "Mark contacted" },
  contacted: { status: "interested", label: "Mark interested" },
};

export function StatusActions({ prospectId, status }: { prospectId: string; status: Status }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(newStatus: Status) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/prospects/${prospectId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) router.refresh();
      else setError((await res.json()).error ?? "Failed to update");
    } finally {
      setPending(false);
    }
  }

  async function runNoteTransition(transition: NoteTransition) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(transition.endpoint(prospectId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...transition.body(note), prospectId }),
      });
      if (res.ok) {
        setCollecting(false);
        setNote("");
        router.refresh();
      } else {
        setError((await res.json()).error ?? "Failed to update");
      }
    } finally {
      setPending(false);
    }
  }

  const noteTransition = NOTE_TRANSITIONS[status];
  const simpleNext = SIMPLE_NEXT[status];
  const isClosed = status === "won" || status === "lost";

  if (noteTransition && collecting) {
    return (
      <div className="space-y-2">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <label className="block">
          <span className="text-sm font-medium text-akani-text-primary">{noteTransition.prompt}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            autoFocus
            placeholder={noteTransition.placeholder}
            className="input mt-1"
          />
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => runNoteTransition(noteTransition)}
            disabled={pending}
            className="flex-1 rounded-md bg-akani-gold px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright disabled:opacity-60"
          >
            {pending ? "Saving…" : noteTransition.confirmLabel}
          </button>
          <button
            onClick={() => setCollecting(false)}
            disabled={pending}
            className="rounded-md border border-akani-card-border px-4 py-2 text-sm font-medium text-akani-text-primary hover:bg-akani-page-bg disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-akani-error">{error}</p>}
      {noteTransition && (
        <button
          onClick={() => setCollecting(true)}
          disabled={pending}
          className="w-full rounded-md bg-akani-gold px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright disabled:opacity-60"
        >
          {noteTransition.label}
        </button>
      )}
      {simpleNext && (
        <button
          onClick={() => updateStatus(simpleNext.status)}
          disabled={pending}
          className="w-full rounded-md bg-akani-gold px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright disabled:opacity-60"
        >
          {pending ? "Updating…" : simpleNext.label}
        </button>
      )}
      {!isClosed && (
        <button
          onClick={() => updateStatus("lost")}
          disabled={pending}
          className="w-full rounded-md border border-akani-card-border px-4 py-2 text-sm font-medium text-akani-text-primary hover:bg-akani-page-bg disabled:opacity-60"
        >
          {pending ? "Updating…" : "Mark lost"}
        </button>
      )}
      {isClosed && (
        <p className="text-center text-sm text-akani-text-secondary">
          This prospect is {status === "won" ? "a paying client" : "closed as lost"}.
        </p>
      )}
    </div>
  );
}
