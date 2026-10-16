import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkProspectAccess } from "@/lib/auth/prospect-access";
import { withServerTenant } from "@/lib/supabase/tenant-insert";
import { isLostReason, lostReasonLabel } from "@/lib/prospects/lost-reasons";
import type { Enums, TablesUpdate } from "@/types/database";

const VALID_STATUSES: Enums<"prospect_status">[] = [
  "identified",
  "qualified",
  "contacted",
  "interested",
  "application",
  "won",
  "lost",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { status, note, lostReason } = await request.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // A reason is required to mark a prospect lost (unlike every other
  // transition's note, which stays optional) -- validated here regardless
  // of what the UI already checked, since the UI's check is a convenience,
  // not the enforcement.
  if (status === "lost" && !isLostReason(lostReason)) {
    return NextResponse.json({ error: "A reason is required to mark this lost." }, { status: 400 });
  }

  const access = await checkProspectAccess(supabase, user.id, id);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const trimmedNote = typeof note === "string" ? note.trim() : "";

  const update: TablesUpdate<"prospects"> = { status };
  // Acting on an unassigned prospect as a sales rep claims it.
  if (access.role === "sales" && !access.assignedTo) update.assigned_to = user.id;
  const now = new Date().toISOString();
  if (status === "qualified") {
    update.qualified_at = now;
    // Qualifying is the one transition where we want a reason on record —
    // it's what "Why this prospect was identified" eventually has to hold
    // up against, not just a status flip.
    update.qualification_status = trimmedNote || "Qualified — no notes recorded";
  }
  if (status === "contacted") update.first_contacted_at = now;
  if (status === "won") update.converted_at = now;
  if (status === "lost") {
    update.lost_reason = lostReason;
    update.lost_reason_note = trimmedNote || null;
  }

  const { data: prospect, error } = await supabase
    .from("prospects")
    .update(update)
    .eq("id", id)
    .select("id, status")
    .single();

  if (error || !prospect) {
    return NextResponse.json(
      { error: error?.message ?? "Prospect not found" },
      { status: 404 },
    );
  }

  const detail =
    status === "lost"
      ? trimmedNote
        ? `${lostReasonLabel(lostReason)}: ${trimmedNote}`
        : lostReasonLabel(lostReason)
      : trimmedNote;

  await supabase.from("activities").insert(withServerTenant({
    prospect_id: id,
    user_id: user.id,
    type: "STATUS_CHANGED",
    description: detail
      ? `Status changed to ${status} — ${detail}`
      : `Status changed to ${status}`,
  }));

  return NextResponse.json({ prospect });
}
