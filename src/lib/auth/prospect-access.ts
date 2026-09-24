import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/types/database";

export type ProspectAccess =
  | { allowed: true; role: Enums<"user_role">; assignedTo: string | null }
  | { allowed: false; status: 403 | 404; error: string };

export function canModifyProspect(
  role: Enums<"user_role">,
  userId: string,
  assignedTo: string | null,
) {
  return role !== "sales" || assignedTo === null || assignedTo === userId;
}

// Mirrors the prospects RLS policy so routes can fail early with a clear
// message instead of leaving half-written rows behind when RLS blocks a
// later step. RLS remains the real enforcement.
export async function checkProspectAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  prospectId: string,
): Promise<ProspectAccess> {
  const [{ data: profile }, { data: prospect }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).single(),
    supabase.from("prospects").select("assigned_to").eq("id", prospectId).maybeSingle(),
  ]);

  if (!prospect) return { allowed: false, status: 404, error: "Prospect not found" };
  if (!profile) return { allowed: false, status: 403, error: "Forbidden" };

  if (!canModifyProspect(profile.role, userId, prospect.assigned_to)) {
    return {
      allowed: false,
      status: 403,
      error: "This prospect is assigned to another team member.",
    };
  }

  return { allowed: true, role: profile.role, assignedTo: prospect.assigned_to };
}
