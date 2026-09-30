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
 *
 * One RPC call (current_tenant_appearance(), a SECURITY DEFINER function
 * joining profiles->tenants in a single round trip), not an RPC to resolve
 * tenant_id followed by a separate select -- the two-round-trip version
 * measurably added to page load time across Dashboard/Analytics/Data
 * Provider/Super Admin Overview, all of which call this.
 */
export async function getTenantAppearance(supabase: SupabaseClient<Database>): Promise<TenantAppearance> {
  const { data } = await supabase.rpc("current_tenant_appearance");
  const tenant = data?.[0];
  if (!tenant?.allow_custom_branding) return DEFAULT;

  return {
    chartStyle: tenant.chart_style === "bar" || tenant.chart_style === "line" ? tenant.chart_style : null,
    layoutStyle: tenant.layout_style === "grid" || tenant.layout_style === "grouped" ? tenant.layout_style : null,
  };
}
