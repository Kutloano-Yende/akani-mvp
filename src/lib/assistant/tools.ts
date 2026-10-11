import { FUNNEL_STAGES } from "@/lib/pipeline-stages";
import { TOOL_HANDLERS, type ToolContext, type ToolHandler } from "./tool-handlers";

const STATUS_ENUM = [...FUNNEL_STAGES.map((s) => s.key), "lost"];

/**
 * Gemini function-calling declarations. Tools 1-5 are safe to offer to
 * every role -- RLS already scopes the underlying tables correctly (own
 * tenant, or everything for a platform admin). list_tenants is only ever
 * included for platform admins (see declarationsFor below) so a tenant
 * admin's model never even learns it exists.
 */
const BASE_DECLARATIONS = [
  {
    name: "count_prospects",
    description: "Count prospects in the pipeline, optionally filtered to one stage.",
    parameters: {
      type: "OBJECT",
      properties: {
        status: { type: "STRING", description: "Pipeline stage to filter by.", enum: STATUS_ENUM },
      },
    },
  },
  {
    name: "count_leads",
    description: "Count inbound leads, optionally within a time window.",
    parameters: {
      type: "OBJECT",
      properties: {
        window: {
          type: "STRING",
          description: "Time window to count within.",
          enum: ["today", "this_week", "this_month", "all"],
        },
      },
    },
  },
  {
    name: "pipeline_breakdown",
    description: "Get a count of prospects at each pipeline stage.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "campaign_stats",
    description: "Get send/reply counts for campaigns, optionally matching a name.",
    parameters: {
      type: "OBJECT",
      properties: {
        campaignName: { type: "STRING", description: "Partial campaign name to match." },
      },
    },
  },
  {
    name: "lookup_users",
    description:
      "Find teammates by name or role. Only ever returns people within the caller's own visibility -- " +
      "their own tenant's team, or every tenant's if the caller is a platform admin.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "Partial name to search for." },
        roleFilter: { type: "STRING", description: "Role to filter by.", enum: ["admin", "manager", "sales"] },
      },
    },
  },
] as const;

const PLATFORM_ADMIN_DECLARATIONS = [
  {
    name: "list_tenants",
    description: "List every tenant on the platform. Only available to platform admins.",
    parameters: { type: "OBJECT", properties: {} },
  },
] as const;

export function declarationsFor(isPlatformAdmin: boolean) {
  return isPlatformAdmin ? [...BASE_DECLARATIONS, ...PLATFORM_ADMIN_DECLARATIONS] : BASE_DECLARATIONS;
}

export function getHandler(name: string): ToolHandler | undefined {
  return TOOL_HANDLERS[name];
}

export type { ToolContext };
