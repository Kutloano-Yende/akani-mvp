import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";
import { findSubjectRecords, normalizeEmail } from "@/lib/popia";

/**
 * Erasure removes the person's identifying details but keeps the business
 * record (company, prospect, pipeline history) intact so reporting doesn't
 * break. The email is added to the suppression list so the person can't be
 * re-imported from the data provider and contacted again — retaining just
 * that address is the standard, lawful way to honour an erasure request.
 *
 * Not covered: free-text in activity descriptions and application notes,
 * which staff typed and could in theory mention the person by name.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: popiaRequest } = await supabase
    .from("popia_requests")
    .select("id, subject_email, request_type, status")
    .eq("id", id)
    .maybeSingle();

  if (!popiaRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (popiaRequest.request_type !== "erasure") {
    return NextResponse.json({ error: "This is not an erasure request" }, { status: 400 });
  }
  if (popiaRequest.status !== "open") {
    return NextResponse.json({ error: "This request is already closed" }, { status: 400 });
  }

  const email = normalizeEmail(popiaRequest.subject_email);
  const { contacts, companies } = await findSubjectRecords(supabase, email);

  if (contacts.length > 0) {
    const { error } = await supabase
      .from("contacts")
      .update({
        first_name: "Erased",
        last_name: null,
        job_title: null,
        email: null,
        phone: null,
        external_id: null,
      })
      .in("id", contacts.map((c) => c.id));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (companies.length > 0) {
    const { error } = await supabase
      .from("companies")
      .update({ email: null, phone: null })
      .in("id", companies.map((c) => c.id));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: suppressError } = await supabase.from("suppression_list").insert({
    email,
    reason: "POPIA erasure request",
    source: "popia",
    created_by: check.userId,
  });
  // 23505 = already suppressed, which is exactly the state we want.
  if (suppressError && suppressError.code !== "23505") {
    return NextResponse.json({ error: suppressError.message }, { status: 500 });
  }

  await supabase
    .from("popia_requests")
    .update({ status: "completed", completed_at: new Date().toISOString(), handled_by: check.userId })
    .eq("id", id);

  await logAudit(supabase, {
    action: "POPIA_ERASURE_COMPLETED",
    entityType: "popia_request",
    entityId: id,
    metadata: { contactsErased: contacts.length, companiesCleared: companies.length },
  });

  return NextResponse.json({
    success: true,
    contactsErased: contacts.length,
    companiesCleared: companies.length,
  });
}
