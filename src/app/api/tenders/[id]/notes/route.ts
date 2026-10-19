import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tenderId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { notes } = await request.json();
  if (typeof notes !== "string") {
    return NextResponse.json({ error: "notes must be a string" }, { status: 400 });
  }

  const trimmed = notes.trim();

  // No explicit tenant_id filter and no assigned_to in this payload --
  // RLS's "saved_tenders updatable within tenant" policy is the real
  // enforcement (ownership-aware, same shape as the prospects status
  // route), and only the role-gated /assign route is ever allowed to set
  // assigned_to -- this route never touches that column.
  const { data: savedTender, error } = await supabase
    .from("saved_tenders")
    .update({ notes: trimmed || null })
    .eq("tender_id", tenderId)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!savedTender) {
    return NextResponse.json({ error: "Save this tender before adding notes" }, { status: 404 });
  }

  return NextResponse.json({ savedTender });
}
