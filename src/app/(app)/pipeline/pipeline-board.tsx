"use client";

import { useState } from "react";
import Link from "next/link";
import type { Enums } from "@/types/database";

export type PipelineCard = {
  id: string;
  status: Enums<"prospect_status">;
  companyName: string;
  industry: string | null;
  opportunityScore: number | null;
};

const COLUMNS: { key: Enums<"prospect_status">; label: string }[] = [
  { key: "identified", label: "Identified" },
  { key: "qualified", label: "Qualified" },
  { key: "contacted", label: "Contacted" },
  { key: "interested", label: "Interested" },
  { key: "application", label: "Application" },
  { key: "won", label: "Paying client" },
];

export function PipelineBoard({ initialCards }: { initialCards: PipelineCard[] }) {
  const [cards, setCards] = useState(initialCards);
  const [dragging, setDragging] = useState<string | null>(null);

  async function moveCard(id: string, status: Enums<"prospect_status">) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    await fetch(`/api/prospects/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colCards = cards.filter((c) => c.status === col.key);
        const isFinal = col.key === "won";
        return (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (id) moveCard(id, col.key);
              setDragging(null);
            }}
            className={`flex w-64 shrink-0 flex-col rounded-xl ${
              isFinal ? "bg-akani-gold-light/20" : "bg-akani-page-bg"
            }`}
          >
            <div className="flex items-center justify-between px-3 py-3">
              <h2
                className={`text-xs font-semibold uppercase tracking-wide ${
                  isFinal ? "text-akani-gold" : "text-akani-text-secondary"
                }`}
              >
                {col.label}
              </h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-akani-text-secondary">
                {colCards.length}
              </span>
            </div>
            <div className="flex-1 space-y-2 px-2 pb-2">
              {colCards.map((card) => (
                <Link
                  key={card.id}
                  href={`/prospects/${card.id}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", card.id);
                    setDragging(card.id);
                  }}
                  onDragEnd={() => setDragging(null)}
                  className={`block cursor-grab rounded-lg border border-akani-card-border bg-white p-3 shadow-sm transition-opacity hover:border-akani-gold ${
                    dragging === card.id ? "opacity-50" : ""
                  }`}
                >
                  <p className="text-sm font-medium text-akani-text-primary">{card.companyName}</p>
                  <p className="mt-0.5 text-xs text-akani-text-secondary">{card.industry ?? "—"}</p>
                  {card.opportunityScore !== null && (
                    <p className="mt-2 text-xs font-medium text-akani-gold">
                      Score {card.opportunityScore}
                    </p>
                  )}
                </Link>
              ))}
              {colCards.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-akani-text-muted">No prospects</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
