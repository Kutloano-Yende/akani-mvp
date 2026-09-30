import { createClient } from "@/lib/supabase/server";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let canManage = false;
  let canBrand = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, tenants(allow_custom_branding)")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "admin";
    canManage = isAdmin || profile?.role === "manager";
    const tenant = Array.isArray(profile?.tenants) ? profile.tenants[0] : profile?.tenants;
    canBrand = tenant?.allow_custom_branding ?? false;
  }

  return (
    <div className="space-y-6">
      <SettingsNav isAdmin={isAdmin} canManage={canManage} canBrand={canBrand} />
      {children}
    </div>
  );
}
