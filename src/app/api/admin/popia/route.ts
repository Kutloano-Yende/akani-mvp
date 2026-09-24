import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";
import { normalizeEmail } from "@/lib/popia";

export async function POST(request: Request) {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  const { requestType, email, name, notes } = await request.json();
  if (requestType !== "access" && requestType !== "erasure") {
    return NextResponse.json({ error: "Request type must be access or erasure" }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("popia_requests")
    .insert({
      request_type: requestType,
      subject_email: normalizeEmail(email),
      subject_name: name?.trim() || null,
      notes: notes?.trim() || null,
      created_by: check.userId,
    })
    .select("id")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? "Failed to log request" }, { status: 400 });
  }

  await logAudit(supabase, {
    action: "POPIA_REQUEST_LOGGED",
    entityType: "popia_request",
    entityId: created.id,
    metadata: { requestType },
  });

  return NextResponse.json({ success: true, id: created.id });
}
