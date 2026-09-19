const STATUS_STYLES: Record<string, string> = {
  identified: "bg-slate-100 text-slate-700",
  qualified: "bg-blue-100 text-blue-700",
  contacted: "bg-amber-100 text-amber-700",
  interested: "bg-purple-100 text-purple-700",
  application: "bg-indigo-100 text-indigo-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}

const OPPORTUNITY_STYLES: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

export function OpportunityBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-slate-400">—</span>;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
        OPPORTUNITY_STYLES[level] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {level}
    </span>
  );
}
