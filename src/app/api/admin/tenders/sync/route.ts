import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";
import { syncTenders, TenderSyncError } from "@/lib/tenders/sync";

export const dynamic = "force-dynamic";

// Same constant-time comparison as src/app/api/cron/leads/route.ts. V1 is
// manually triggered by a platform admin from the UI -- this header check
// exists now so a future automated trigger (a second Vercel cron slot, or a
// Supabase pg_cron job) needs only a config change, not a code change.
function cronAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

async function runSync(month: string | undefined, viaCron: boolean) {
  // tenders has RLS-enabled with zero write policies for `authenticated`
  // (it's deliberately global reference data, see the migration) -- this
  // write must go through the service-role client, same pattern as
  // src/app/api/admin/tenants/route.ts's own RLS-locked insert.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  try {
    const result = await syncTenders(admin, month);

    if (!viaCron) {
      const supabase = await createClient();
      await logAudit(supabase, {
        action: "TENDERS_SYNCED",
        entityType: "tenders",
        metadata: { month: month ?? "current", ...result },
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TenderSyncError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("Tender sync failed", err);
    return NextResponse.json({ error: "Tender sync failed" }, { status: 500 });
  }
}

// Vercel Cron always calls its configured path with GET (same as
// src/app/api/cron/leads/route.ts) -- cron-secret only, no platform-admin
// session fallback, since a scheduled invocation never carries a user
// session. Always syncs the current month; Cron can't supply a body.
export async function GET(request: Request) {
  if (!cronAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSync(undefined, true);
}

// The manual "Sync now" path (today: a platform admin running this from the
// browser console, per the Phase 1 scope -- no UI button yet), which can
// also pass an explicit { month } to backfill a specific month.
export async function POST(request: Request) {
  const viaCron = cronAuthorised(request);
  if (!viaCron) {
    const check = await requirePlatformAdmin();
    if (!check.authorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: check.status });
    }
  }

  const body = await request.json().catch(() => ({}));
  const month = typeof body.month === "string" ? body.month : undefined;

  return runSync(month, viaCron);
}
