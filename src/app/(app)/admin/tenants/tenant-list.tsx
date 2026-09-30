"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantRow } from "./page";

export function TenantList({ tenants }: { tenants: TenantRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleStatus(tenant: TenantRow) {
    const nextStatus = tenant.status === "active" ? "suspended" : "active";
    setPending(`status:${tenant.id}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't update that tenant.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't update that tenant. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  async function toggleBranding(tenant: TenantRow) {
    setPending(`branding:${tenant.id}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/branding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowCustomBranding: !tenant.allowCustomBranding }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't update that tenant.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't update that tenant. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-akani-card-border text-akani-text-muted">
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Slug</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Branding</th>
              <th className="py-2 font-medium">Users</th>
              <th className="py-2 font-medium">Created</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-b border-akani-card-border last:border-0">
                <td className="py-3 font-medium text-akani-text-primary">{t.name}</td>
                <td className="py-3 text-akani-text-muted">{t.slug}</td>
                <td className="py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.status === "active" ? "bg-akani-success-bg text-akani-success" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.allowCustomBranding
                        ? "bg-akani-gold/15 text-akani-gold"
                        : "bg-akani-page-bg text-akani-text-muted"
                    }`}
                  >
                    {t.allowCustomBranding ? "Allowed" : "Not allowed"}
                  </span>
                </td>
                <td className="py-3 text-akani-text-secondary">{t.userCount}</td>
                <td className="py-3 text-akani-text-muted">{new Date(t.created_at).toLocaleDateString("en-ZA")}</td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => toggleBranding(t)}
                      disabled={pending === `branding:${t.id}`}
                      className="rounded-md border border-akani-card-border px-3 py-1.5 text-xs font-medium text-akani-text-primary hover:bg-akani-page-bg disabled:opacity-60"
                    >
                      {pending === `branding:${t.id}`
                        ? "Working…"
                        : t.allowCustomBranding
                          ? "Revoke branding"
                          : "Allow branding"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStatus(t)}
                      disabled={pending === `status:${t.id}`}
                      className="rounded-md border border-akani-card-border px-3 py-1.5 text-xs font-medium text-akani-text-primary hover:bg-akani-page-bg disabled:opacity-60"
                    >
                      {pending === `status:${t.id}` ? "Working…" : t.status === "active" ? "Suspend" : "Reactivate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-akani-text-muted">
                  No tenants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
