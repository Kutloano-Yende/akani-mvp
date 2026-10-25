import type { OcdsRelease } from "./ocds-types";
import { guessProvince } from "./province-guess";
import type { Json } from "@/types/database";

/** Matches the `tenders` table's insert shape (snake_case columns), minus
 * the DB-generated id/search_vector/first_synced_at/created_at/updated_at. */
export type NormalizedTender = {
  ocid: string;
  release_id: string;
  tender_number: string | null;
  title: string;
  description: string | null;
  status: string;
  main_procurement_category: string | null;
  buyer_id: string | null;
  buyer_name: string | null;
  province_guess: string | null;
  tender_period_start: string | null;
  tender_period_end: string | null;
  value_amount: number | null;
  value_currency: string | null;
  documents: Json;
  source_url: string | null;
  published_date: string;
  raw: Json;
  last_synced_at: string;
};

/**
 * Maps one OCDS release to a `tenders` row. Pure function, no I/O -- every
 * coercion here reflects a gap confirmed against real downloaded data (see
 * the migration's column comments), not spec guesswork:
 * - `mainProcurementCategory: ""` (seen in ~24% of a real sample) becomes
 *   null, never an empty string.
 * - `province_guess` is always derived, never trusted from the source (there
 *   is no real province field to trust).
 * - `source_url` is the first document's url, if any -- the closest thing to
 *   an official "view this tender" link the data provides.
 */
export function normalizeRelease(release: OcdsRelease): NormalizedTender {
  const { tender } = release;
  const category = tender.mainProcurementCategory?.trim();
  const documents = tender.documents ?? [];

  return {
    ocid: release.ocid,
    release_id: release.id,
    tender_number: tender.id || null,
    title: tender.title,
    description: tender.description?.trim() || null,
    status: tender.status,
    main_procurement_category: category ? category : null,
    buyer_id: release.buyer?.id ?? null,
    buyer_name: release.buyer?.name ?? null,
    province_guess: guessProvince(release.buyer?.name),
    tender_period_start: tender.tenderPeriod?.startDate ?? null,
    tender_period_end: tender.tenderPeriod?.endDate ?? null,
    value_amount: typeof tender.value?.amount === "number" ? tender.value.amount : null,
    value_currency: tender.value?.currency ?? null,
    // OcdsDocument[]/OcdsRelease are plain JSON-shaped data (confirmed
    // against real downloaded API responses), just not structurally provable
    // against the generated Json union through TS's indexed-signature check.
    documents: documents as unknown as Json,
    source_url: documents[0]?.url ?? null,
    published_date: release.date,
    raw: release as unknown as Json,
    last_synced_at: new Date().toISOString(),
  };
}

/** Matches the `tender_awards` table's insert shape, minus the DB-generated
 * id/created_at/updated_at. `ocid` (not `tender_id`) is carried here since
 * the tender's DB id isn't known until after the `tenders` upsert -- see
 * sync.ts, which resolves ocid -> tender_id once that upsert returns. */
export type NormalizedAward = {
  ocid: string;
  award_id: string;
  supplier_name: string;
  value_amount: number | null;
  value_currency: string | null;
};

/**
 * Extracts one row per (award, supplier) pair from a release's `awards[]`.
 * Pure function, no I/O.
 *
 * Confirmed against a real sample containing awards: only 28 of 690
 * releases (~4%) carried any award data at all, and it wasn't correlated
 * with `tender.status` (several awarded releases were still "active", not
 * "complete") -- so callers must treat "has an award" as its own signal,
 * never inferred from status.
 *
 * Deliberately extracts ONLY `supplier.Name` and the award's value --
 * nothing else from the award/party data is trustworthy as belonging to the
 * winning company. In particular, the matching OCDS "supplier" *party*
 * record's `contactPoint` (email/phone/contact name) was confirmed, across
 * every real award sample inspected, to actually be the BUYER's own
 * procurement officer contact, not the supplier's -- e.g. a release whose
 * supplier is "VODACOM" carries contactPoint email "tshepom@ceta.co.za",
 * the buyer's domain. That field must never be read as the supplier's own
 * contact, so this function doesn't touch `parties` at all.
 */
export function extractAwards(release: OcdsRelease): NormalizedAward[] {
  const awards = release.awards ?? [];
  const rows: NormalizedAward[] = [];

  for (const award of awards) {
    for (const supplier of award.suppliers ?? []) {
      const name = supplier.Name?.trim();
      if (!name) continue; // never store an award row with no identifiable winner

      rows.push({
        ocid: release.ocid,
        award_id: award.id,
        supplier_name: name,
        value_amount: typeof award.value?.amount === "number" ? award.value.amount : null,
        value_currency: award.value?.currency ?? null,
      });
    }
  }

  return rows;
}

/**
 * Dedupes releases that share an ocid within the same sync batch, keeping
 * the one with the latest `date` -- the real source data can contain more
 * than one release per ocid in a given month (e.g. a status change), and
 * every release in these feeds is a full "compiled" snapshot (verified:
 * `tag` is `["compiled"]` for 100% of a real sample), so the latest one
 * fully supersedes any earlier one for the same ocid rather than needing to
 * be merged with it.
 */
export function dedupeByOcid(releases: OcdsRelease[]): OcdsRelease[] {
  const latest = new Map<string, OcdsRelease>();
  for (const release of releases) {
    const existing = latest.get(release.ocid);
    if (!existing || release.date >= existing.date) {
      latest.set(release.ocid, release);
    }
  }
  return [...latest.values()];
}
