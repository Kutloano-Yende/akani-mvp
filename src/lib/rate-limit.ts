/**
 * In-memory sliding-window-ish rate limiter. Good enough for a single
 * Node.js server instance. It does NOT work correctly across multiple
 * server instances or serverless invocations (each has its own memory, so
 * limits reset per-instance) — a real multi-instance deployment needs a
 * shared store (Upstash Redis, etc.) instead. Fine for this app's current
 * single-instance deployment; revisit before scaling out.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

// Prevent unbounded growth from many distinct keys (e.g. one per IP) over
// a long-running process.
const MAX_BUCKETS = 10_000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    if (buckets.size >= MAX_BUCKETS) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}
