"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateTenantForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, adminName, adminEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't create that tenant.");
        return;
      }
      if (data.warning) {
        setError(data.warning);
      } else {
        setSuccess("Tenant created and the admin invite is on its way.");
      }
      setName("");
      setAdminName("");
      setAdminEmail("");
      router.refresh();
    } catch {
      setError("Couldn't create that tenant. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Company name</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input mt-1"
          placeholder="Acme Ratings"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Tenant admin name</span>
        <input
          type="text"
          required
          value={adminName}
          onChange={(e) => setAdminName(e.target.value)}
          className="input mt-1"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Tenant admin email</span>
        <input
          type="email"
          required
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          className="input mt-1"
        />
      </label>

      <div className="sm:col-span-3">
        {error && <div className="mb-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-3 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create tenant"}
        </button>
      </div>
    </form>
  );
}
