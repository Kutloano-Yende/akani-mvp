"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Entry = {
  id: string;
  email: string | null;
  phone: string | null;
  reason: string | null;
  created_at: string;
};

export function SuppressionList({ entries }: { entries: Entry[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/suppression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add entry");
        return;
      }
      setEmail("");
      setReason("");
      router.refresh();
    });
  }

  function handleRemove(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/suppression", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to remove entry");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-akani-error-bg px-3 py-2 text-sm text-akani-error">{error}</div>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap gap-3">
        <input
          type="email"
          placeholder="Email to suppress"
          className="input flex-1 min-w-[10rem]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Reason (optional)"
          className="input flex-1 min-w-[10rem]"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-akani-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-akani-deep-blue disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-akani-card-border text-akani-text-muted">
            <th className="py-2 font-medium">Email</th>
            <th className="py-2 font-medium">Reason</th>
            <th className="py-2 font-medium">Added</th>
            <th className="py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-akani-card-border last:border-0">
              <td className="py-3 text-akani-text-primary">{entry.email ?? entry.phone}</td>
              <td className="py-3 text-akani-text-secondary">{entry.reason ?? "—"}</td>
              <td className="py-3 text-akani-text-secondary">
                {new Date(entry.created_at).toLocaleDateString("en-ZA")}
              </td>
              <td className="py-3 text-right">
                <button
                  onClick={() => handleRemove(entry.id)}
                  disabled={isPending}
                  className="text-akani-error hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-akani-text-muted">
                No suppressed contacts yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
