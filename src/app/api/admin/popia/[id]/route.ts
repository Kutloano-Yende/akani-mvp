import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";

// Closes a request without erasing anything: an access request once the
// export has been delivered, or any request the admin decides to reject.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  const { id } = await params;
  const { status } = await request.json();
  if (status !== "completed" && status !== "rejected") {
    return NextResponse.json({ error: "Status must be completed or rejected" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("popia_requests")
    .update({ status, completed_at: new Date().toISOString(), handled_by: check.userId })
    .eq("id", id)
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "Request not found or already closed" },
      { status: 404 },
    );
  }

  await logAudit(supabase, {
    action: status === "completed" ? "POPIA_REQUEST_COMPLETED" : "POPIA_REQUEST_REJECTED",
    entityType: "popia_request",
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
