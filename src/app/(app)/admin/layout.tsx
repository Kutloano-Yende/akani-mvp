import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/require-role";

// Auth itself is already handled by (app)/layout.tsx -- this nested layout
// only adds the extra platform-admin gate. Non-platform-admins are bounced
// to their normal dashboard, not shown a 403 -- they should never know this
// area exists at all.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const check = await requirePlatformAdmin();
  if (!check.authorized) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
