import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Sets the caller's own tenant's brand colors. Writes go through the
 * service-role client, not RLS -- tenants has no write policy, by design
 * (see the sprint15 migration): "has allow_custom_branding been granted"
 * is a business rule enforced here, not spread across RLS/column grants.
 */
export async function PATCH(request: Request) {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  const { primaryColor, accentColor } = await request.json();
  if (primaryColor !== null && !HEX_COLOR.test(primaryColor ?? "")) {
    return NextResponse.json({ error: "primaryColor must be a hex color like #07124c" }, { status: 400 });
  }
  if (accentColor !== null && !HEX_COLOR.test(accentColor ?? "")) {
    return NextResponse.json({ error: "accentColor must be a hex color like #d6a000" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: tenantId } = await supabase.rpc("current_tenant_id");
  if (!tenantId) {
    return NextResponse.json({ error: "No active tenant found for your account" }, { status: 400 });
  }

  const { data: tenant } = await supabase.from("tenants").select("allow_custom_branding").eq("id", tenantId).single();
  if (!tenant?.allow_custom_branding) {
    return NextResponse.json({ error: "Custom branding isn't enabled for your tenant" }, { status: 403 });
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin
    .from("tenants")
    .update({ brand_primary_color: primaryColor, brand_accent_color: accentColor })
    .eq("id", tenantId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit(supabase, {
    action: "TENANT_BRANDING_COLORS_UPDATED",
    entityType: "tenant",
    entityId: tenantId,
    metadata: { primaryColor, accentColor },
  });

  return NextResponse.json({ success: true });
}
