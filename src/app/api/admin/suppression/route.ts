import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  const { email, reason } = await request.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const supabase = await createClient();

  const { error } = await supabase.from("suppression_list").insert({
    email: normalizedEmail,
    reason: reason || null,
    created_by: check.userId,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "That email is already suppressed" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logAudit(supabase, {
    action: "SUPPRESSION_ADDED",
    entityType: "suppression_list",
    metadata: { email: normalizedEmail, reason: reason || null },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("suppression_list")
    .select("email")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("suppression_list").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logAudit(supabase, {
    action: "SUPPRESSION_REMOVED",
    entityType: "suppression_list",
    entityId: id,
    metadata: { email: existing?.email ?? null },
  });

  return NextResponse.json({ success: true });
}
