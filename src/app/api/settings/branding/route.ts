import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";
import type { TablesUpdate } from "@/types/database";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Sets the caller's own tenant's appearance (colors, chart style, Analytics
 * layout) -- one PATCH, fields are independent and each optional (the
 * colors form and the charts form both post to this same route, each
 * sending only the fields it owns). Writes go through the service-role
 * client, not RLS -- tenants has no write policy, by design (see the
 * sprint15 migration): "has allow_custom_branding been granted" is a
 * business rule enforced here, not spread across RLS/column grants.
 */
export async function PATCH(request: Request) {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  const body = await request.json();
  const update: TablesUpdate<"tenants"> = {};

  if ("primaryColor" in body) {
    if (!HEX_COLOR.test(body.primaryColor ?? "")) {
      return NextResponse.json({ error: "primaryColor must be a hex color like #07124c" }, { status: 400 });
    }
    update.brand_primary_color = body.primaryColor;
  }
  if ("accentColor" in body) {
    if (!HEX_COLOR.test(body.accentColor ?? "")) {
      return NextResponse.json({ error: "accentColor must be a hex color like #d6a000" }, { status: 400 });
    }
    update.brand_accent_color = body.accentColor;
  }
  if ("chartStyle" in body) {
    if (body.chartStyle !== "bar" && body.chartStyle !== "line") {
      return NextResponse.json({ error: "chartStyle must be 'bar' or 'line'" }, { status: 400 });
    }
    update.chart_style = body.chartStyle;
  }
  if ("layoutStyle" in body) {
    if (body.layoutStyle !== "grid" && body.layoutStyle !== "grouped") {
      return NextResponse.json({ error: "layoutStyle must be 'grid' or 'grouped'" }, { status: 400 });
    }
    update.layout_style = body.layoutStyle;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
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
  const { error } = await admin.from("tenants").update(update).eq("id", tenantId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const isColorUpdate = "brand_primary_color" in update || "brand_accent_color" in update;
  await logAudit(supabase, {
    action: isColorUpdate ? "TENANT_BRANDING_COLORS_UPDATED" : "TENANT_APPEARANCE_UPDATED",
    entityType: "tenant",
    entityId: tenantId,
    metadata: update,
  });

  return NextResponse.json({ success: true });
}
