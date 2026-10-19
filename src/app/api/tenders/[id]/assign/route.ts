import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Same gate as prospect reassignment (src/app/api/prospects/[id]/assign/route.ts)
  // -- a plain sales user cannot reassign, even their own save.
  const check = await requireRole(["admin", "manager"]);
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  const { id: tenderId } = await params;
  const { assigneeId } = await request.json();
  const supabase = await createClient();

  if (assigneeId) {
    const { data: assignee } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", assigneeId)
      .maybeSingle();
    if (!assignee) {
      return NextResponse.json({ error: "Team member not found" }, { status: 400 });
    }
  }

  // No explicit tenant_id filter -- RLS scopes this to the caller's tenant.
  const { data: savedTender, error } = await supabase
    .from("saved_tenders")
    .update({ assigned_to: assigneeId || null })
    .eq("tender_id", tenderId)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!savedTender) {
    return NextResponse.json({ error: "Save this tender before assigning it" }, { status: 404 });
  }

  return NextResponse.json({ savedTender });
}
