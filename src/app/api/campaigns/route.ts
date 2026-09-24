import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*, email_templates(name), campaign_prospects(status)")
    .order("created_at", { ascending: false });

  return NextResponse.json({ campaigns: campaigns ?? [] });
}

export async function POST(request: Request) {
  const check = await requireRole(["admin", "manager"]);
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }
  const user = { id: check.userId };
  const supabase = await createClient();

  const { name, description, templateId } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      template_id: templateId || null,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error || !campaign) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create campaign" },
      { status: 500 },
    );
  }

  return NextResponse.json({ campaign });
}
