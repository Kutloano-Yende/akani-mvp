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

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role, avatar_url, sidebar_collapsed")
    .eq("id", user.id)
    .single();

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      role={profile?.role ?? "sales"}
      avatarUrl={profile?.avatar_url ?? null}
      initialSidebarCollapsed={profile?.sidebar_collapsed ?? false}
    >
      {children}
    </AppShell>
  );
}
