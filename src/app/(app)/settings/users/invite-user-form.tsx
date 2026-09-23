"use client";

import { useState, useTransition } from "react";
import type { Enums } from "@/types/database";

type Role = Enums<"user_role">;

export function InviteUserForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("sales");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send invite");
        return;
      }
      setSuccess(true);
      setEmail("");
      setName("");
      setRole("sales");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-md bg-akani-error-bg px-3 py-2 text-sm text-akani-error">{error}</div>
      )}
      {success && (
        <div className="rounded-md bg-akani-success-bg px-3 py-2 text-sm text-akani-success">
          Invite sent.
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Full name"
          className="input flex-1 min-w-[10rem]"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email address"
          className="input flex-1 min-w-[10rem]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <select className="input w-32" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="sales">Sales</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-akani-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-akani-deep-blue disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Send invite"}
        </button>
      </div>
    </form>
  );
}
