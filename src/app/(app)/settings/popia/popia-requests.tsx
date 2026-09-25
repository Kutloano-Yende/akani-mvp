"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Select } from "@/components/select";

type PopiaRequest = {
  id: string;
  request_type: string;
  subject_email: string;
  subject_name: string | null;
  notes: string | null;
  status: string;
  due_at: string;
  completed_at: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-akani-warning-bg text-akani-warning",
  completed: "bg-akani-success-bg text-akani-success",
  rejected: "bg-slate-100 text-akani-text-secondary",
};

export function PopiaRequests({ requests }: { requests: PopiaRequest[] }) {
  const router = useRouter();
  const [requestType, setRequestType] = useState("access");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<Response>, onOk?: (data: Record<string, unknown>) => void) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      onOk?.(data);
      router.refresh();
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    run(
      () =>
        fetch("/api/admin/popia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestType, email, name, notes }),
        }),
      () => {
        setEmail("");
        setName("");
        setNotes("");
      },
    );
  }

  function handleErase(r: PopiaRequest) {
    const ok = window.confirm(
      `Erase all personal details held for ${r.subject_email}? This cannot be undone. Their address will be added to the suppression list.`,
    );
    if (!ok) return;
    run(
      () => fetch(`/api/admin/popia/${r.id}/erase`, { method: "POST" }),
      (data) =>
        setMessage(
          `Erased ${data.contactsErased} contact(s) and cleared ${data.companiesCleared} company contact detail(s).`,
        ),
    );
  }

  function handleClose(id: string, status: "completed" | "rejected") {
    run(() =>
      fetch(`/api/admin/popia/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md bg-akani-error-bg px-3 py-2 text-sm text-akani-error">{error}</div>
      )}
      {message && (
        <div className="rounded-md bg-akani-success-bg px-3 py-2 text-sm text-akani-success">{message}</div>
      )}

      <form onSubmit={handleCreate} className="space-y-3 rounded-lg bg-akani-page-bg p-4">
        <div className="flex flex-wrap gap-3">
          <Select
            aria-label="Request type"
            className="w-44"
            value={requestType}
            onChange={setRequestType}
            options={[
              { value: "access", label: "Access request" },
              { value: "erasure", label: "Erasure request" },
            ]}
          />
          <input
            type="email"
            placeholder="Data subject's email"
            className="input min-w-[12rem] flex-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Name (optional)"
            className="input min-w-[10rem] flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Notes (optional)"
            className="input flex-1"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-akani-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-akani-deep-blue disabled:opacity-50"
          >
            Log request
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-akani-card-border text-akani-text-muted">
              <th className="py-2 font-medium">Subject</th>
              <th className="py-2 font-medium">Type</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Due</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const overdue = r.status === "open" && new Date(r.due_at) < new Date();
              return (
                <tr key={r.id} className="border-b border-akani-card-border align-top last:border-0">
                  <td className="py-3">
                    <p className="text-akani-text-primary">{r.subject_email}</p>
                    {(r.subject_name || r.notes) && (
                      <p className="text-xs text-akani-text-muted">
                        {[r.subject_name, r.notes].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="py-3 capitalize text-akani-text-secondary">{r.request_type}</td>
                  <td className="py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        STATUS_STYLES[r.status] ?? STATUS_STYLES.rejected
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className={`py-3 whitespace-nowrap ${overdue ? "font-medium text-akani-error" : "text-akani-text-secondary"}`}>
                    {new Date(r.due_at).toLocaleDateString("en-ZA")}
                    {overdue && " (overdue)"}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <a
                      href={`/api/admin/popia/${r.id}/export`}
                      className="mr-3 text-akani-gold hover:underline"
                    >
                      Export
                    </a>
                    {r.status === "open" && (
                      <>
                        {r.request_type === "erasure" ? (
                          <button
                            onClick={() => handleErase(r)}
                            disabled={isPending}
                            className="mr-3 text-akani-error hover:underline disabled:opacity-50"
                          >
                            Erase
                          </button>
                        ) : (
                          <button
                            onClick={() => handleClose(r.id, "completed")}
                            disabled={isPending}
                            className="mr-3 text-akani-success hover:underline disabled:opacity-50"
                          >
                            Mark complete
                          </button>
                        )}
                        <button
                          onClick={() => handleClose(r.id, "rejected")}
                          disabled={isPending}
                          className="text-akani-text-secondary hover:underline disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {requests.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-akani-text-muted">
                  No requests logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
