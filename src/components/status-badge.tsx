/**
 * Status colors follow the Akani design system's fixed vocabulary —
 * success/warning/error/info/neutral — never ad-hoc colors, so a status
 * means the same thing everywhere it appears.
 */
const STATUS_STYLES: Record<string, string> = {
  identified: "bg-slate-100 text-akani-text-secondary",
  qualified: "bg-akani-info-bg text-akani-info",
  contacted: "bg-akani-warning-bg text-akani-warning",
  interested: "bg-akani-info-bg text-akani-info",
  application: "bg-amber-100 text-amber-800",
  won: "bg-akani-success-bg text-akani-success",
  lost: "bg-akani-error-bg text-akani-error",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        STATUS_STYLES[status] ?? "bg-slate-100 text-akani-text-secondary"
      }`}
    >
      {status}
    </span>
  );
}

const OPPORTUNITY_STYLES: Record<string, string> = {
  high: "bg-akani-success-bg text-akani-success",
  medium: "bg-akani-warning-bg text-akani-warning",
  low: "bg-slate-100 text-akani-text-secondary",
};

export function OpportunityBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-akani-text-muted">—</span>;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
        OPPORTUNITY_STYLES[level] ?? "bg-slate-100 text-akani-text-secondary"
      }`}
    >
      {level}
    </span>
  );
}
