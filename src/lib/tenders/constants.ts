/** OCDS's documented categories -- only services/works/goods were actually
 * observed in a real sample (consultingServices never appeared), but all
 * four are offered as filters since the source data legitimately allows it. */
export const PROCUREMENT_CATEGORIES = ["goods", "works", "services", "consultingServices"] as const;

/** OCDS's documented tender.status values -- active/complete/cancelled/
 * planning were actually observed in a real sample; unsuccessful/withdrawn
 * are included since they're valid per the spec even though not seen. */
export const TENDER_STATUSES = [
  "planning",
  "active",
  "complete",
  "cancelled",
  "unsuccessful",
  "withdrawn",
] as const;

/** The tenant's own pipeline state for a saved tender -- matches the
 * `saved_tenders.status` check constraint in
 * supabase/migrations/20261017093400_sprint28_tender_intelligence.sql. */
export const SAVED_TENDER_STATUSES = [
  "saved",
  "in_progress",
  "submitted",
  "won",
  "lost",
  "archived",
] as const;
