import type { Enums } from "@/types/database";

// Shared by the status API route (validation + activity description) and the
// "Mark lost" UI (dropdown options), so they can't drift out of sync.
export const LOST_REASONS: { value: Enums<"prospect_lost_reason">; label: string }[] = [
  { value: "not_a_fit", label: "Not a good fit" },
  { value: "budget_pricing", label: "Budget or pricing" },
  { value: "no_response", label: "No response" },
  { value: "chose_competitor", label: "Chose a competitor" },
  { value: "not_ready_timing", label: "Not ready / timing" },
  { value: "invalid_contact_details", label: "Invalid contact details" },
  { value: "other", label: "Other" },
];

const LOST_REASON_VALUES = LOST_REASONS.map((r) => r.value);

export function isLostReason(value: unknown): value is Enums<"prospect_lost_reason"> {
  return typeof value === "string" && (LOST_REASON_VALUES as string[]).includes(value);
}

export function lostReasonLabel(value: Enums<"prospect_lost_reason">): string {
  return LOST_REASONS.find((r) => r.value === value)?.label ?? value;
}
