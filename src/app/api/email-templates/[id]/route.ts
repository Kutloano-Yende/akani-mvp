import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/types/database";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, subject, body } = await request.json();
  const update: TablesUpdate<"email_templates"> = {};
  if (typeof name === "string" && name.trim()) update.name = name.trim();
  if (typeof subject === "string" && subject.trim()) update.subject = subject.trim();
  if (typeof body === "string" && body.trim()) update.body = body;

  const { data: template, error } = await supabase
    .from("email_templates")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !template) {
    return NextResponse.json(
      { error: error?.message ?? "Template not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ template });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("email_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
