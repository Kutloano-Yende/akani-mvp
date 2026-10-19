/**
 * Shapes for National Treasury's eTenders OCDS release data. Field presence
 * below reflects what was actually verified in a real downloaded monthly
 * file (690 releases, July 2026), not just the OCDS spec -- e.g. `buyer` is
 * confirmed to only ever carry `id`/`name` (never an address), and
 * `tender.value.amount` is confirmed to be 0 for nearly every pre-award
 * release. See supabase/migrations/20261017093400_sprint28_tender_intelligence.sql
 * for how these fields map onto the `tenders` table.
 */

export type OcdsDocument = {
  id: string;
  documentType?: string;
  title?: string;
  description?: string;
  url?: string;
  datePublished?: string;
  dateModified?: string;
  format?: string;
  language?: string;
};

export type OcdsTender = {
  id: string;
  title: string;
  status: string;
  // Confirmed empty-string (not absent) when uncategorized -- normalized to
  // null, see ocds-normalize.ts.
  mainProcurementCategory?: string;
  description?: string;
  value?: { amount?: number; currency?: string };
  documents?: OcdsDocument[];
  tenderPeriod?: { startDate?: string; endDate?: string };
  tenderers?: { name?: string; id?: string }[];
};

export type OcdsBuyer = {
  id?: string;
  name?: string;
};

export type OcdsRelease = {
  ocid: string;
  id: string;
  date: string;
  tag?: string[];
  initiationType?: string;
  tender: OcdsTender;
  buyer?: OcdsBuyer;
  parties?: unknown[];
  awards?: unknown[];
  contracts?: unknown[];
  language?: string;
};

export type OcdsReleasePackage = {
  Uri?: string;
  Version?: string;
  PublishedDate?: string;
  Publisher?: { Name?: string; Uri?: string };
  License?: string;
  PublicationPolicy?: string;
  Releases: OcdsRelease[];
};
