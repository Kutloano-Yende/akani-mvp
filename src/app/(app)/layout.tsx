import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { getActiveImpersonation } from "@/lib/impersonation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: isPlatformAdmin }, impersonation] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "name, role, avatar_url, sidebar_collapsed, tenants(status, allow_custom_branding, brand_primary_color, brand_accent_color, brand_logo_url)",
      )
      .eq("id", user.id)
      .single(),
    supabase.rpc("is_platform_admin"),
    getActiveImpersonation(),
  ]);

  const tenant = Array.isArray(profile?.tenants) ? profile.tenants[0] : profile?.tenants;

  // A suspended tenant's users already lose access to every RLS-protected
  // query (current_tenant_id() returns null for them) -- this just gives
  // them a clear reason instead of every page silently looking empty.
  if (tenant?.status === "suspended") {
    redirect("/account-suspended");
  }

  // Re-validated here even though the DB already enforces this format (a
  // CHECK constraint) -- these values are about to go straight into a
  // <style> tag, so never trust that without checking it directly.
  const HEX_COLOR = /^#[0-9a-f]{6}$/i;
  // A platform admin's own profile still belongs to a tenant (today, always
  // Akani's), so without this check a tenant customising its own branding
  // would re-skin the super admin's view too -- the platform admin's UI
  // must stay the fixed Akani look no matter what any tenant, including
  // their own, has configured.
  const applyTenantBranding = !isPlatformAdmin && tenant?.allow_custom_branding;
  const brandPrimaryColor =
    applyTenantBranding && HEX_COLOR.test(tenant.brand_primary_color ?? "") ? tenant.brand_primary_color : null;
  const brandAccentColor =
    applyTenantBranding && HEX_COLOR.test(tenant.brand_accent_color ?? "") ? tenant.brand_accent_color : null;
  const brandLogoUrl = applyTenantBranding ? tenant.brand_logo_url : null;

  return (
    <>
      {/* Rendered server-side (no flash of Akani's default colors, unlike a
          client effect) and applied at :root so it also reaches portaled
          content (dialogs, the assistant widget) that lives outside
          AppShell's own DOM subtree -- a plain inline style on a wrapping
          div wouldn't. Every akani-navy/akani-gold utility across the app
          reads these two variables (see globals.css). */}
      {(brandPrimaryColor || brandAccentColor) && (
        <style>{`:root{${brandPrimaryColor ? `--brand-primary:${brandPrimaryColor};` : ""}${
          brandAccentColor ? `--brand-accent:${brandAccentColor};` : ""
        }}`}</style>
      )}
      <AppShell
        userName={profile?.name ?? user.email ?? "User"}
        role={profile?.role ?? "sales"}
        avatarUrl={profile?.avatar_url ?? null}
        initialSidebarCollapsed={profile?.sidebar_collapsed ?? false}
        isPlatformAdmin={isPlatformAdmin ?? false}
        brandLogoUrl={brandLogoUrl}
        impersonation={impersonation}
      >
        {children}
      </AppShell>
    </>
  );
}
