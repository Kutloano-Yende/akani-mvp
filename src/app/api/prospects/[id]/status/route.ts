import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

  const { status } = await request.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const update: TablesUpdate<"prospects"> = { status };
  const now = new Date().toISOString();
  if (status === "qualified") update.qualified_at = now;
  if (status === "contacted") update.first_contacted_at = now;
  if (status === "won") update.converted_at = now;

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

  await supabase.from("activities").insert({
    prospect_id: id,
    user_id: user.id,
    type: "STATUS_CHANGED",
    description: `Status changed to ${status}`,
  });

  return NextResponse.json({ prospect });
}
