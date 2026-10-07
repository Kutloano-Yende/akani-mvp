// Shared between the client-side countdown/warning (idle-timeout-manager.tsx)
// and the server-side enforcement (middleware.ts) so the two can't drift.
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const IDLE_WARNING_MS = 60 * 1000;
export const LAST_ACTIVITY_COOKIE = "last_activity";
