import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type TenantAppearance = {
  chartStyle: "bar" | "line" | null;
  layoutStyle: "grid" | "grouped" | null;
};

const DEFAULT: TenantAppearance = { chartStyle: null, layoutStyle: null };

/**
 * A tenant's chart/layout preference, or null for both when the tenant
 * hasn't been granted custom branding (or hasn't set one) -- null means
 * "no preference, keep each component's own current default", not "bar"/
 * "grouped" literally, so an unbranded tenant's pages render exactly as
 * they did before this existed.
 */
export async function getTenantAppearance(supabase: SupabaseClient<Database>): Promise<TenantAppearance> {
  const { data: tenantId } = await supabase.rpc("current_tenant_id");
  if (!tenantId) return DEFAULT;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("allow_custom_branding, chart_style, layout_style")
    .eq("id", tenantId)
    .single();

  if (!tenant?.allow_custom_branding) return DEFAULT;

  return {
    chartStyle: tenant.chart_style === "bar" || tenant.chart_style === "line" ? tenant.chart_style : null,
    layoutStyle: tenant.layout_style === "grid" || tenant.layout_style === "grouped" ? tenant.layout_style : null,
  };
}
