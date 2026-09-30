import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { BrandingColorForm } from "./branding-color-form";
import { BrandingLogoUpload } from "./branding-logo-upload";

export default async function BrandingSettingsPage() {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    redirect("/settings/security");
  }

  const supabase = await createClient();
  const { data: tenantId } = await supabase.rpc("current_tenant_id");
  const { data: tenant } = tenantId
    ? await supabase
        .from("tenants")
        .select("allow_custom_branding, brand_primary_color, brand_accent_color, brand_logo_url")
        .eq("id", tenantId)
        .single()
    : { data: null };

  if (!tenant?.allow_custom_branding) {
    return (
      <div className="max-w-2xl space-y-6">
        <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">Branding</h2>
          <p className="text-sm text-akani-text-secondary">
            Custom colors and a logo aren&apos;t enabled for your organization yet. Ask your platform administrator
            to turn this on.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">Brand colors</h2>
        <p className="mb-4 text-sm text-akani-text-secondary">
          Applied across the whole app — the sidebar, buttons, links and highlights.
        </p>
        <BrandingColorForm
          initialPrimaryColor={tenant.brand_primary_color}
          initialAccentColor={tenant.brand_accent_color}
        />
      </section>

      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">Logo</h2>
        <p className="mb-4 text-sm text-akani-text-secondary">Shown in the sidebar in place of the Akani wordmark.</p>
        <BrandingLogoUpload logoUrl={tenant.brand_logo_url} />
      </section>
    </div>
  );
}
