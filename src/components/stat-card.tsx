/**
 * Shared KPI card used across the signed-in app (Dashboard, Analytics,
 * Settings > Data Provider, Campaign detail). `trend`, when given, must be
 * a real computed delta — never a placeholder number — so leave it out
 * rather than fabricate one where the underlying data doesn't support it.
 */
export function StatCard({
  label,
  value,
  supportingText,
  trend,
  accent,
}: {
  label: string;
  value: number | string;
  supportingText?: string;
  trend?: { direction: "up" | "down"; label: string };
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-akani-card-border bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-akani-text-muted">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p
          className={`text-3xl font-bold ${accent ? "text-akani-gold" : "text-akani-text-primary"}`}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {trend && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${
              trend.direction === "up" ? "text-akani-success" : "text-akani-error"
            }`}
          >
            {trend.direction === "up" ? "▲" : "▼"} {trend.label}
          </span>
        )}
      </div>
      {supportingText && (
        <p className="mt-1 text-xs text-akani-text-muted">{supportingText}</p>
      )}
    </div>
  );
}
