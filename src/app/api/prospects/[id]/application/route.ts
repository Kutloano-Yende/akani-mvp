import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkProspectAccess } from "@/lib/auth/prospect-access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: prospectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await checkProspectAccess(supabase, user.id, prospectId);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { notes } = await request.json();
  const trimmedNotes = typeof notes === "string" ? notes.trim() : "";

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .insert({
      prospect_id: prospectId,
      notes: trimmedNotes || null,
      created_by: user.id,
    })
    .select("id, status, submitted_at")
    .single();

  if (applicationError || !application) {
    return NextResponse.json(
      { error: applicationError?.message ?? "Failed to start application" },
      { status: 500 },
    );
  }

  const { error: prospectError } = await supabase
    .from("prospects")
    .update({ status: "application" })
    .eq("id", prospectId);

  if (prospectError) {
    return NextResponse.json({ error: prospectError.message }, { status: 500 });
  }

  await supabase.from("activities").insert({
    prospect_id: prospectId,
    user_id: user.id,
    type: "APPLICATION_STARTED",
    description: trimmedNotes ? `Application started — ${trimmedNotes}` : "Application started",
  });

  return NextResponse.json({ application });
}
