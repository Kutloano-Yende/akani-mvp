import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const MOCK_PROVIDER_NAME = "Mock Catalogue";

export function dailyProviderLimit() {
  return Number(process.env.PROVIDER_DAILY_SEARCH_LIMIT) || 60;
}

// A hard daily ceiling on billable provider calls (searches and enrichments),
// separate from the per-minute limit, so a busy day can't quietly use up the
// plan's credits.
export async function dailyLimitReached(
  supabase: SupabaseClient<Database>,
  providerName: string,
): Promise<boolean> {
  if (providerName === MOCK_PROVIDER_NAME) return false;
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("api_usage")
    .select("*", { count: "exact", head: true })
    .eq("provider", providerName)
    .gte("created_at", startOfDay.toISOString());
  return (count ?? 0) >= dailyProviderLimit();
}
