/**
 * Weekly new-prospects chart — muted history, the current (rightmost) week
 * picked out in the accent color, either as bars (default) or a line.
 * Presentational only; the page computes real counts from
 * prospects.created_at and passes them in. Colors are Tailwind fill/stroke
 * classes, not literal hex, so they follow a tenant's brand colors the
 * same way every other akani-branded element does.
 */
export function SalesChart({
  data,
  variant = "bar",
}: {
  data: { label: string; value: number }[];
  variant?: "bar" | "line";
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 600;
  const height = 200;

  return (
    <svg viewBox={`0 0 ${width} ${height + 24}`} className="h-48 w-full" role="img" aria-label="New prospects per week">
      {[0, 0.5, 1].map((f) => (
        <line
          key={f}
          x1="0"
          x2={width}
          y1={height - height * f}
          y2={height - height * f}
          className="stroke-akani-card-border"
          strokeWidth="1"
        />
      ))}
      {variant === "line" ? (
        <LineSeries data={data} max={max} width={width} height={height} />
      ) : (
        <BarSeries data={data} max={max} width={width} height={height} />
      )}
      {data.map((d, i) => {
        const barGap = 14;
        const barWidth = (width - barGap * (data.length - 1)) / data.length;
        const x = i * (barWidth + barGap) + barWidth / 2;
        return (
          <text key={d.label} x={x} y={height + 18} textAnchor="middle" fontSize="11" className="fill-akani-text-muted">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

function BarSeries({
  data,
  max,
  width,
  height,
}: {
  data: { label: string; value: number }[];
  max: number;
  width: number;
  height: number;
}) {
  const barGap = 14;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;
  return (
    <>
      {data.map((d, i) => {
        const barHeight = Math.max((d.value / max) * (height - 12), d.value > 0 ? 4 : 0);
        const isLast = i === data.length - 1;
        const x = i * (barWidth + barGap);
        return (
          <rect
            key={d.label}
            x={x}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx="4"
            className={isLast ? "fill-akani-gold" : "fill-akani-navy"}
            opacity={isLast ? 1 : 0.85}
          />
        );
      })}
    </>
  );
}

function LineSeries({
  data,
  max,
  width,
  height,
}: {
  data: { label: string; value: number }[];
  max: number;
  width: number;
  height: number;
}) {
  const pad = 6;
  const points = data.map((d, i) => {
    const x = data.length === 1 ? pad : (i / (data.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - (d.value / max) * (height - pad * 2);
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points[points.length - 1];

  return (
    <>
      <path
        d={path}
        fill="none"
        vectorEffect="non-scaling-stroke"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-akani-navy"
      />
      <circle cx={lastX} cy={lastY} r="5" className="fill-akani-gold" />
    </>
  );
}
