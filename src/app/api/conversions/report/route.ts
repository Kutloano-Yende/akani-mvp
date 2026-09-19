import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Records that a prospect became a paying client. Deliberately minimal:
 * prospect_id, a status, a date, and free-text notes the reporting user
 * chooses to include — nothing about the underlying deal or engagement.
 * That's the boundary the proposal's Akani/Bantu confidentiality split
 * calls for: Akani can report a conversion happened without exposing
 * confidential client-engagement details through this system.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { prospectId, notes } = await request.json();
  if (!prospectId) {
    return NextResponse.json({ error: "prospectId is required" }, { status: 400 });
  }

  const trimmedNotes = typeof notes === "string" ? notes.trim() : "";
  const now = new Date().toISOString();

  const { data: conversion, error: conversionError } = await supabase
    .from("conversions")
    .insert({
      prospect_id: prospectId,
      status: "confirmed",
      converted_at: now,
      reported_by: user.id,
      notes: trimmedNotes || null,
    })
    .select("id, status, converted_at")
    .single();

  if (conversionError || !conversion) {
    return NextResponse.json(
      { error: conversionError?.message ?? "Failed to report conversion" },
      { status: 500 },
    );
  }

  const { error: prospectError } = await supabase
    .from("prospects")
    .update({ status: "won", converted_at: now })
    .eq("id", prospectId);

  if (prospectError) {
    return NextResponse.json({ error: prospectError.message }, { status: 500 });
  }

  await supabase.from("activities").insert({
    prospect_id: prospectId,
    user_id: user.id,
    type: "CONVERSION_REPORTED",
    description: trimmedNotes
      ? `Reported as a paying client — ${trimmedNotes}`
      : "Reported as a paying client",
  });

  return NextResponse.json({ conversion });
}
