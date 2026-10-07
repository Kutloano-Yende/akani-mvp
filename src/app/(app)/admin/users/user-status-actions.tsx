"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UserStatusActions({
  userId,
  name,
  status,
  disabledReason,
}: {
  userId: string;
  name: string;
  status: "active" | "suspended";
  /** Set when this row is the signed-in admin's own account, or the sole remaining platform admin. */
  disabledReason?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"status" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = !!disabledReason || loading !== null;

  async function toggleStatus() {
    if (disabled) return;
    const next = status === "active" ? "suspended" : "active";
    if (
      next === "suspended" &&
      !window.confirm(`Suspend ${name}? They'll be signed out and unable to sign in until reactivated.`)
    ) {
      return;
    }
    setLoading("status");
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to update status");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setLoading(null);
    }
  }

  async function deleteUser() {
    if (disabled) return;
    if (
      !window.confirm(
        `Permanently delete ${name}? This can't be undone, and only works if they have no activity on record.`,
      )
    ) {
      return;
    }
    setLoading("delete");
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete user");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete user");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="text-right">
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={toggleStatus}
          disabled={disabled}
          title={disabledReason}
          className="rounded-md border border-akani-card-border px-3 py-1 text-xs font-medium text-akani-text-primary transition hover:bg-akani-page-bg disabled:opacity-50"
        >
          {loading === "status" ? "Saving…" : status === "active" ? "Suspend" : "Reactivate"}
        </button>
        <button
          type="button"
          onClick={deleteUser}
          disabled={disabled}
          title={disabledReason}
          className="rounded-md border border-akani-error/30 px-3 py-1 text-xs font-medium text-akani-error transition hover:bg-akani-error-bg disabled:opacity-50"
        >
          {loading === "delete" ? "Deleting…" : "Delete"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-akani-error">{error}</p>}
    </div>
  );
}
