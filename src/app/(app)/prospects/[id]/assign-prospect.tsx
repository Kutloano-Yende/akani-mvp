"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Select } from "@/components/select";

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
      <Select
        aria-label="Owner"
        value={assignedTo ?? ""}
        disabled={isPending}
        onChange={handleChange}
        options={[{ value: "", label: "Unassigned" }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
      />
    </div>
  );
}
