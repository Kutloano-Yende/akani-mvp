import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export async function getCurrentUser(): Promise<{ id: string; role: Enums<"user_role"> } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile ? { id: user.id, role: profile.role } : null;
}
