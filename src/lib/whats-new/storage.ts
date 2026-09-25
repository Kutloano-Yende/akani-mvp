export const KEYS = {
  // Set just before an update reload so the next page can greet the user.
  updating: "akani:updating",
  justUpdated: "akani:justUpdated",
  releaseSeen: "akani:releaseSeen",
  dismissedVersion: "akani:dismissedVersion",
} as const;

// Storage can be blocked (private mode, disabled cookies); the feature must
// simply do nothing then, never throw.
function store(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function read(key: string, kind: "local" | "session" = "local"): string | null {
  try {
    return store(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function write(key: string, value: string, kind: "local" | "session" = "local") {
  try {
    store(kind)?.setItem(key, value);
  } catch {
    // ignore
  }
}

export function remove(key: string, kind: "local" | "session" = "local") {
  try {
    store(kind)?.removeItem(key);
  } catch {
    // ignore
  }
}

// True if a timestamp stored under `key` is recent.
export function isFresh(key: string, maxAgeMs: number): boolean {
  const at = Number(read(key));
  return Number.isFinite(at) && at > 0 && Date.now() - at < maxAgeMs;
}
