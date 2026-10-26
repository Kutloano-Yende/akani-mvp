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

/** Terms that, when found in a tender's title/description, suggest it
 * explicitly calls out B-BBEE / preferential procurement. There is no
 * structured "requires B-BBEE" field anywhere in the real OCDS data (every
 * SA government tender above a small-value threshold already requires a
 * B-BBEE certificate under the PPPFA, so a dedicated field never existed in
 * the first place) -- this is a best-effort text match over whatever the
 * buyer happened to write, not a verified requirement. Deliberately
 * excludes the bare word "BEE" -- too short, too likely to false-positive
 * on unrelated words. */
export const BBEE_KEYWORDS = [
  "B-BBEE",
  "BBBEE",
  "broad-based black economic empowerment",
  "preferential procurement",
] as const;

/** Builds a PostgREST `.or()` filter string matching any BBEE_KEYWORDS term,
 * case-insensitively, in either `title` or `description`. Uses `ilike`
 * rather than `search_vector`/`textSearch`, since Postgres's default
 * English tsvector tokenizer splits a hyphenated acronym like "B-BBEE" into
 * separate stems ("b", "bbee") and a websearch query for it doesn't
 * reliably match back. */
export function bbeeOrFilter(): string {
  return BBEE_KEYWORDS.flatMap((term) => [`title.ilike.%${term}%`, `description.ilike.%${term}%`]).join(",");
}
