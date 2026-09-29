import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: isPlatformAdmin }] = await Promise.all([
    supabase
      .from("profiles")
      .select("name, role, avatar_url, sidebar_collapsed, tenants(status)")
      .eq("id", user.id)
      .single(),
    supabase.rpc("is_platform_admin"),
  ]);

  // A suspended tenant's users already lose access to every RLS-protected
  // query (current_tenant_id() returns null for them) -- this just gives
  // them a clear reason instead of every page silently looking empty.
  const tenantStatus = Array.isArray(profile?.tenants) ? profile.tenants[0]?.status : profile?.tenants?.status;
  if (tenantStatus === "suspended") {
    redirect("/account-suspended");
  }

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      role={profile?.role ?? "sales"}
      avatarUrl={profile?.avatar_url ?? null}
      initialSidebarCollapsed={profile?.sidebar_collapsed ?? false}
      isPlatformAdmin={isPlatformAdmin ?? false}
    >
      {children}
    </AppShell>
  );
}
