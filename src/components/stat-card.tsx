/**
 * Shared KPI card used across the signed-in app (Dashboard, Analytics,
 * Settings > Data Provider, Super Admin Overview). `delta` and `sparkline`,
 * when given, must be real computed values — never a placeholder — so leave
 * them out rather than fabricate one where the underlying data doesn't
 * support it (e.g. a point-in-time status count like "currently qualified"
 * has no change log to derive a real past trend from).
 */
export function StatCard({
  label,
  value,
  supportingText,
  delta,
  sparkline,
  accent,
}: {
  label: string;
  value: number | string;
  supportingText?: string;
  delta?: { direction: "up" | "down"; label: string };
  /** Real historical values, oldest first, ending at (or near) the current value. */
  sparkline?: number[];
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
        {delta && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${
              delta.direction === "up" ? "text-akani-success" : "text-akani-error"
            }`}
          >
            {delta.direction === "up" ? "▲" : "▼"} {delta.label}
          </span>
        )}
      </div>
      {sparkline && sparkline.length >= 2 && <Sparkline values={sparkline} />}
      {supportingText && (
        <p className="mt-1 text-xs text-akani-text-muted">{supportingText}</p>
      )}
    </div>
  );
}

// 12-point sparkline: the history in a muted hue, the most recent period
// picked out in the accent color, per the stat-tile convention.
function Sparkline({ values }: { values: number[] }) {
  const width = 100;
  const height = 28;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values.map((v, i) => {
    const x = values.length === 1 ? pad : (i / (values.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [prevX, prevY] = points[points.length - 2];
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="mt-3 h-7 w-full"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        vectorEffect="non-scaling-stroke"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-akani-card-border"
      />
      <path
        d={`M${prevX.toFixed(1)},${prevY.toFixed(1)} L${lastX.toFixed(1)},${lastY.toFixed(1)}`}
        fill="none"
        vectorEffect="non-scaling-stroke"
        strokeWidth="2"
        strokeLinecap="round"
        className="stroke-akani-gold"
      />
      <circle cx={lastX} cy={lastY} r="2.5" className="fill-akani-gold" />
    </svg>
  );
}
