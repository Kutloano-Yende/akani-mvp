/**
 * Weekly new-prospects bar chart — navy bars, the current (rightmost) week
 * highlighted in gold. Presentational only; the page computes real counts
 * from prospects.created_at and passes them in.
 */
export function SalesChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 600;
  const height = 200;
  const barGap = 14;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height + 24}`} className="h-48 w-full" role="img" aria-label="New prospects per week">
      {[0, 0.5, 1].map((f) => (
        <line
          key={f}
          x1="0"
          x2={width}
          y1={height - height * f}
          y2={height - height * f}
          stroke="#e0e4ec"
          strokeWidth="1"
        />
      ))}
      {data.map((d, i) => {
        const barHeight = Math.max((d.value / max) * (height - 12), d.value > 0 ? 4 : 0);
        const isLast = i === data.length - 1;
        const x = i * (barWidth + barGap);
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              rx="4"
              fill={isLast ? "#d6a000" : "#0a155a"}
              opacity={isLast ? 1 : 0.85}
            />
            <text
              x={x + barWidth / 2}
              y={height + 18}
              textAnchor="middle"
              fontSize="11"
              fill="#98a2b3"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
