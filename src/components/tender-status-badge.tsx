/**
 * Mirrors status-badge.tsx's fixed-vocabulary convention, kept as its own
 * small component rather than added to STATUS_STYLES there: these are the
 * OCDS tender.status values (National Treasury's own vocabulary), a
 * different domain from prospect_status, and conflating the two color maps
 * would risk one feature's status accidentally styling the other's.
 */
const TENDER_STATUS_STYLES: Record<string, string> = {
  active: "bg-akani-success-bg text-akani-success",
  planning: "bg-akani-info-bg text-akani-info",
  complete: "bg-slate-100 text-akani-text-secondary",
  cancelled: "bg-akani-error-bg text-akani-error",
  unsuccessful: "bg-akani-error-bg text-akani-error",
  withdrawn: "bg-akani-error-bg text-akani-error",
};

export function TenderStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        TENDER_STATUS_STYLES[status] ?? "bg-slate-100 text-akani-text-secondary"
      }`}
    >
      {status}
    </span>
  );
}

/** For province_guess, which is nullable and always estimated, never
 * authoritative -- see src/lib/tenders/province-guess.ts. */
export function ProvinceBadge({ province }: { province: string | null }) {
  if (!province) {
    return <span className="text-akani-text-muted">Unknown</span>;
  }
  return <span title="Estimated from the buyer's name, not official data">{province} (est.)</span>;
}
