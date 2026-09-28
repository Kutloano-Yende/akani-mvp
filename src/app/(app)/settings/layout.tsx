import { createClient } from "@/lib/supabase/server";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let canManage = false;
  let isPlatformAdmin = false;
  if (user) {
    const [{ data: profile }, { data: platformAdmin }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase.rpc("is_platform_admin"),
    ]);
    isAdmin = profile?.role === "admin";
    canManage = isAdmin || profile?.role === "manager";
    isPlatformAdmin = platformAdmin ?? false;
  }

  return (
    <div className="space-y-6">
      <SettingsNav isAdmin={isAdmin} canManage={canManage} isPlatformAdmin={isPlatformAdmin} />
      {children}
    </div>
  );
}
