"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Enums } from "@/types/database";

type Role = Enums<"user_role">;

type Profile = {
  id: string;
  name: string;
  role: Role;
  created_at: string;
};

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  sales: "Sales",
};

export function UsersTable({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleMfaReset(userId: string, name: string) {
    if (!window.confirm(`Remove ${name}'s two-factor authentication? They will need to set it up again.`)) {
      return;
    }
    setError(null);
    setNotice(null);
    setPendingId(userId);
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}/mfa-reset`, { method: "POST" });
      const data = await res.json();
      setPendingId(null);
      if (!res.ok) {
        setError(data.error ?? "Failed to reset 2FA");
        return;
      }
      setNotice(`Removed ${data.factorsRemoved} 2FA factor(s) for ${name}.`);
    });
  }

  function handleRoleChange(userId: string, role: Role) {
    setError(null);
    setPendingId(userId);
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      setPendingId(null);
      if (!res.ok) {
        setError(data.error ?? "Failed to update role");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-akani-error-bg px-3 py-2 text-sm text-akani-error">{error}</div>
      )}
      {notice && (
        <div className="rounded-md bg-akani-success-bg px-3 py-2 text-sm text-akani-success">{notice}</div>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-akani-card-border text-akani-text-muted">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Role</th>
            <th className="py-2 font-medium">Joined</th>
            <th className="py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile) => (
            <tr key={profile.id} className="border-b border-akani-card-border last:border-0">
              <td className="py-3 text-akani-text-primary">
                {profile.name}
                {profile.id === currentUserId && (
                  <span className="ml-2 text-xs text-akani-text-muted">(you)</span>
                )}
              </td>
              <td className="py-3">
                <select
                  className="input w-32 py-1"
                  value={profile.role}
                  disabled={profile.id === currentUserId || (isPending && pendingId === profile.id)}
                  onChange={(e) => handleRoleChange(profile.id, e.target.value as Role)}
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-3 text-akani-text-secondary">
                {new Date(profile.created_at).toLocaleDateString("en-ZA")}
              </td>
              <td className="py-3 text-right">
                {profile.id !== currentUserId && (
                  <button
                    onClick={() => handleMfaReset(profile.id, profile.name)}
                    disabled={isPending && pendingId === profile.id}
                    className="text-akani-text-secondary hover:text-akani-error hover:underline disabled:opacity-50"
                  >
                    Reset 2FA
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
