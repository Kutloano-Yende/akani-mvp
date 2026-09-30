export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Buckets timestamped items into `periods` consecutive weekly sums, oldest
 * first, ending with the current (partial) week. `value` defaults to 1 per
 * item, so omitting it gives a per-week count; passing it sums a numeric
 * field (e.g. credits_used) instead.
 *
 * Only use this where a metric's history is actually reconstructable from
 * real created_at timestamps — never for a point-in-time status snapshot
 * (e.g. "how many prospects are currently qualified" has no change log to
 * derive a real past trend from). See StatCard's own doc comment: a trend
 * must be a real computed delta, never fabricated.
 */
export function weeklySums(
  items: { date: string | Date; value?: number }[],
  periods = 12,
  now: number = Date.now(),
): number[] {
  return Array.from({ length: periods }, (_, i) => {
    const weeksAgo = periods - 1 - i;
    const start = now - (weeksAgo + 1) * WEEK_MS;
    const end = now - weeksAgo * WEEK_MS;
    let sum = 0;
    for (const item of items) {
      const t = new Date(item.date).getTime();
      if (t >= start && t < end) sum += item.value ?? 1;
    }
    return sum;
  });
}

// Turns per-period values into a running total — for a "total X over time"
// sparkline (growing toward the stat's current total) rather than a
// "new X per period" one.
export function cumulative(counts: number[], startingTotal = 0): number[] {
  let running = startingTotal;
  return counts.map((c) => (running += c));
}

/**
 * A `periods`-week cumulative "total over time" sparkline, ending at the
 * true current total/sum — items older than the window are folded into the
 * starting total rather than dropped, so the last point always matches the
 * real value. `value` defaults to 1 per item (a running count); pass it to
 * sum a numeric field instead (e.g. credits_used).
 */
export function cumulativeSparkline(
  items: { date: string | Date; value?: number }[],
  periods = 12,
  now: number = Date.now(),
): number[] {
  const windowStart = now - periods * WEEK_MS;
  const inWindow: typeof items = [];
  let startingTotal = 0;
  for (const item of items) {
    if (new Date(item.date).getTime() < windowStart) startingTotal += item.value ?? 1;
    else inWindow.push(item);
  }
  return cumulative(weeklySums(inWindow, periods, now), startingTotal);
}
