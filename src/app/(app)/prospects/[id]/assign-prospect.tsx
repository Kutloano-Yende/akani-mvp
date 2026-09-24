"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Member = { id: string; name: string };

export function AssignProspect({
  prospectId,
  assignedTo,
  members,
}: {
  prospectId: string;
  assignedTo: string | null;
  members: Member[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(assigneeId: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/prospects/${prospectId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: assigneeId || null }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Failed to assign");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-akani-error">{error}</p>}
      <select
        className="input"
        value={assignedTo ?? ""}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}
