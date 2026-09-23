import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

type Role = Enums<"user_role">;

export type RoleCheck =
  | { authorized: true; userId: string; role: Role }
  | { authorized: false; status: 401 | 403 };

/**
 * Server-side role gate for API routes and server actions. UI-level hiding
 * (e.g. not rendering an admin nav item) is cosmetic only — this is the
 * actual enforcement point, since RLS alone doesn't know about app roles
 * beyond what's baked into individual policies.
 */
export async function requireRole(allowed: Role[]): Promise<RoleCheck> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { authorized: false, status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !allowed.includes(profile.role)) {
    return { authorized: false, status: 403 };
  }

  return { authorized: true, userId: user.id, role: profile.role };
}
