/**
 * For tables whose tenant_id is assigned by a database trigger on every
 * insert made through an authenticated session — see the Phase 1 tenancy
 * migration, supabase/migrations/20260927100000_sprint9_tenancy_foundation.sql.
 * The server, not client code, decides tenant_id there, and any value this
 * process sends is silently overridden. The generated Supabase types don't
 * know about the trigger and mark the column required, so this fills it with
 * a value that's never actually sent (dropped by JSON.stringify) purely to
 * satisfy that type. Never pass a real value through here.
 *
 * T is inferred directly from the row literal (not via Omit<T, "tenant_id">,
 * which TypeScript can't reliably infer through), so callers get normal
 * type-checking on every other field.
 */
export function withServerTenant<T extends Record<string, unknown>>(
  row: T,
): T & { tenant_id: string } {
  return { ...row, tenant_id: undefined } as unknown as T & { tenant_id: string };
}

export function withServerTenantMany<T extends Record<string, unknown>>(
  rows: T[],
): (T & { tenant_id: string })[] {
  return rows.map((row) => withServerTenant(row));
}
