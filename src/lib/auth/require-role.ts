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

export type PlatformAdminCheck =
  | { authorized: true; userId: string }
  | { authorized: false; status: 401 | 403 };

/**
 * Server-side gate for platform-admin-only surfaces (audit logs, later the
 * Super Admin area). Separate from role/requireRole on purpose: platform
 * admin is not a tenant role (see the multi-tenancy migrations) -- a tenant
 * admin never passes this, no matter how the `admin` role check would go.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdminCheck> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { authorized: false, status: 401 };

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
  if (!isPlatformAdmin) return { authorized: false, status: 403 };

  return { authorized: true, userId: user.id };
}
