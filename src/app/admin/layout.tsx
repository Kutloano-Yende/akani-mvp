import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/require-role";
import { SuperAdminShell } from "@/components/super-admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Non-platform-admins are bounced to their normal dashboard, not shown a
  // 403 — they should never know this area exists at all.
  const check = await requirePlatformAdmin();
  if (!check.authorized) {
    redirect("/dashboard");
  }

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
