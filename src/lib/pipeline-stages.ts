// The prospect pipeline's stages, in funnel order. Shared by the dashboard
// (the funnel chart) and the assistant's pipeline_breakdown tool so the two
// can't drift apart.
export const FUNNEL_STAGES = [
  { key: "identified", label: "Businesses Found" },
  { key: "qualified", label: "Qualified" },
  { key: "contacted", label: "Contacted" },
  { key: "interested", label: "Interested" },
  { key: "application", label: "Application" },
  { key: "won", label: "Paying Client" },
] as const;

export type PipelineStageKey = (typeof FUNNEL_STAGES)[number]["key"] | "lost";
