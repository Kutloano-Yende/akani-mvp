import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Per-user display preferences — currently just the sidebar's collapsed state. */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (typeof body.sidebarCollapsed !== "boolean") {
    return NextResponse.json({ error: "sidebarCollapsed must be a boolean" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ sidebar_collapsed: body.sidebarCollapsed })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
