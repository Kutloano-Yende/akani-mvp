import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withServerTenant } from "@/lib/supabase/tenant-insert";

export async function POST(
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

  const { data: savedTender, error } = await supabase
    .from("saved_tenders")
    .insert(withServerTenant({ tender_id: tenderId, saved_by: user.id }))
    .select("*")
    .single();

  if (error) {
    const message = error.code === "23505" ? "This tender is already saved" : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ savedTender });
}

export async function DELETE(
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

  // No explicit tenant_id filter -- RLS's "saved_tenders deletable within
  // tenant" policy (saved_by = caller, or admin/manager) is the real
  // enforcement, same pattern as every other tenant-scoped mutation in
  // this codebase.
  const { error, count } = await supabase
    .from("saved_tenders")
    .delete({ count: "exact" })
    .eq("tender_id", tenderId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json({ error: "Saved tender not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
