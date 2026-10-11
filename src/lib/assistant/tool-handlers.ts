import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/types/database";
import { FUNNEL_STAGES } from "@/lib/pipeline-stages";

type Client = SupabaseClient<Database>;

export type ToolContext = {
  role: Enums<"user_role">;
  isPlatformAdmin: boolean;
};

/**
 * Every handler queries through the caller's own session client (passed in,
 * never the service-role client) so RLS alone does the tenant/role scoping
 * -- a tenant user's query only ever touches their own tenant's rows, a
 * platform admin's sees everything. No manual tenant_id filtering here.
 */
export type ToolHandler = (supabase: Client, ctx: ToolContext, args: Record<string, unknown>) => Promise<unknown>;

const STATUS_KEYS = [...FUNNEL_STAGES.map((s) => s.key), "lost"] as const;

export async function countProspects(supabase: Client, _ctx: ToolContext, args: Record<string, unknown>) {
  let query = supabase.from("prospects").select("*", { count: "exact", head: true });
  const status = typeof args.status === "string" ? args.status : undefined;
  if (status) {
    if (!(STATUS_KEYS as readonly string[]).includes(status)) {
      return { error: `Unknown status "${status}". Valid values: ${STATUS_KEYS.join(", ")}.` };
    }
    query = query.eq("status", status as (typeof STATUS_KEYS)[number]);
  }
  const { count, error } = await query;
  if (error) return { error: error.message };
  return { count: count ?? 0, status: status ?? "all" };
}

const LEAD_WINDOWS = ["today", "this_week", "this_month", "all"] as const;

function windowStart(window: (typeof LEAD_WINDOWS)[number]): string | null {
  const now = new Date();
  if (window === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  if (window === "this_week") {
    const start = new Date(now);
    const day = start.getDay(); // 0 = Sunday
    const diffToMonday = (day + 6) % 7;
    start.setDate(start.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  if (window === "this_month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
  return null;
}

export async function countLeads(supabase: Client, _ctx: ToolContext, args: Record<string, unknown>) {
  const window = typeof args.window === "string" && (LEAD_WINDOWS as readonly string[]).includes(args.window)
    ? (args.window as (typeof LEAD_WINDOWS)[number])
    : "all";
  let query = supabase.from("leads").select("*", { count: "exact", head: true });
  const since = windowStart(window);
  if (since) query = query.gte("created_at", since);
  const { count, error } = await query;
  if (error) return { error: error.message };
  return { count: count ?? 0, window };
}

export async function pipelineBreakdown(supabase: Client) {
  const { data, error } = await supabase.from("prospects").select("status");
  if (error) return { error: error.message };
  const counts: Record<string, number> = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]));
  for (const row of data ?? []) {
    if (row.status in counts) counts[row.status] += 1;
  }
  return {
    stages: FUNNEL_STAGES.map((s) => ({ key: s.key, label: s.label, count: counts[s.key] })),
    lost: counts.lost,
  };
}

export async function campaignStats(supabase: Client, _ctx: ToolContext, args: Record<string, unknown>) {
  let query = supabase
    .from("campaigns")
    .select("name, status, campaign_prospects(status)")
    .order("created_at", { ascending: false });
  const name = typeof args.campaignName === "string" ? args.campaignName : undefined;
  if (name) query = query.ilike("name", `%${name}%`);
  const { data, error } = await query.limit(10);
  if (error) return { error: error.message };
  return {
    campaigns: (data ?? []).map((c) => {
      const prospects = c.campaign_prospects ?? [];
      return {
        name: c.name,
        status: c.status,
        prospects: prospects.length,
        sent: prospects.filter((p) => p.status !== "pending").length,
        replied: prospects.filter((p) => p.status === "replied").length,
      };
    }),
  };
}

export async function lookupUsers(supabase: Client, _ctx: ToolContext, args: Record<string, unknown>) {
  let query = supabase.from("profiles").select("name, role, tenants(name)").order("name").limit(20);
  const name = typeof args.query === "string" ? args.query : undefined;
  const roleFilter = typeof args.roleFilter === "string" ? args.roleFilter : undefined;
  if (name) query = query.ilike("name", `%${name}%`);
  if (roleFilter) query = query.eq("role", roleFilter as Enums<"user_role">);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return {
    // RLS already scoped this to "their own tenant, or everyone if
    // platform admin" -- no manual filtering needed here.
    users: (data ?? []).map((u) => ({
      name: u.name,
      role: u.role,
      tenant: Array.isArray(u.tenants) ? u.tenants[0]?.name : u.tenants?.name,
    })),
  };
}

export async function listTenants(supabase: Client, ctx: ToolContext) {
  // Defense in depth: this tool is only declared to the model for platform
  // admins (see tools.ts), but check again here independent of that, and
  // independent of RLS (which already has zero read policies for `tenants`
  // by non-platform-admins).
  if (!ctx.isPlatformAdmin) return { error: "Only available to platform admins." };
  const { data, error } = await supabase.from("tenants").select("name, status").order("name");
  if (error) return { error: error.message };
  return { tenants: data ?? [] };
}

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  count_prospects: countProspects,
  count_leads: countLeads,
  pipeline_breakdown: (supabase) => pipelineBreakdown(supabase),
  campaign_stats: campaignStats,
  lookup_users: lookupUsers,
  list_tenants: (supabase, ctx) => listTenants(supabase, ctx),
};
