import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: templates } = await supabase
    .from("email_templates")
    .select("*")
    .order("created_at", { ascending: false });

  return NextResponse.json({ templates: templates ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, subject, body, includePermissionButtons } = await request.json();
  if (!name?.trim() || !subject?.trim() || !body?.trim()) {
    return NextResponse.json(
      { error: "Name, subject, and body are all required" },
      { status: 400 },
    );
  }

  const { data: template, error } = await supabase
    .from("email_templates")
    .insert({
      name: name.trim(),
      subject: subject.trim(),
      body,
      include_permission_buttons: includePermissionButtons === true,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error || !template) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create template" },
      { status: 500 },
    );
  }

  return NextResponse.json({ template });
}
