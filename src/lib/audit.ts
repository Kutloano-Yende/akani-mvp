import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

/**
 * Records a security-relevant action. Not for every CRUD operation — the
 * `activities` table already covers prospect-level history. This is for
 * the things a real audit trail needs: sign-in/out, role changes, MFA
 * enable/disable, suppression-list changes.
 *
 * Takes the caller's own Supabase client rather than creating a new one —
 * right after an action like sign-in, that's the client instance that
 * reliably carries the just-established session.
 *
 * user_id is NOT trusted from here — a DB trigger (set_audit_user_id)
 * overwrites it with the session's own auth.uid() on insert, so this
 * can't be used to attribute an action to someone else.
 */
export async function logAudit(
  supabase: SupabaseClient<Database>,
  params: {
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, Json>;
  },
) {
  const headerList = await headers();

  await supabase.from("audit_logs").insert({
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    metadata: params.metadata ?? null,
    // Only meaningful behind a proxy that sets this (e.g. Vercel); null in
    // local dev, which is expected.
    ip_address: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: headerList.get("user-agent"),
  });
}
