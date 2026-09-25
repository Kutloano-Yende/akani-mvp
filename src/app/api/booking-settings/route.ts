import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";
import { parseBookingSettings } from "@/lib/booking/settings";

export async function PUT(request: Request) {
  const check = await requireRole(["admin", "manager"]);
  if (!check.authorized) return NextResponse.json({ error: "Forbidden" }, { status: check.status });

  const parsed = parseBookingSettings(await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_settings")
    .update({ ...parsed.value, updated_at: new Date().toISOString() })
    .eq("id", true)
    .select("id")
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Couldn't save" }, { status: 400 });

  await logAudit(supabase, { action: "BOOKING_SETTINGS_UPDATED", entityType: "booking_settings" });
  return NextResponse.json({ success: true });
}
