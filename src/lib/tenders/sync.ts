import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { OcdsReleasePackage } from "./ocds-types";
import { normalizeRelease, dedupeByOcid } from "./ocds-normalize";

const DOWNLOAD_BASE = "https://data.etenders.gov.za/Home/DownloadFile/";
// The monthly bulk JSON files, not the live query API -- confirmed via
// direct testing that /api/OCDSReleases currently returns 400/500 on every
// attempted date range and even on a single-ocid lookup, while these files
// fetch and parse reliably. See the approved plan's API findings.
const UPSERT_CHUNK_SIZE = 500;
// ~1.1MB observed for one real month -- longer than lusha-provider.ts's 20s
// pattern, since this is a single larger file rather than a paginated API call.
const FETCH_TIMEOUT_MS = 60_000;

export class TenderSyncError extends Error {}

function currentMonthParam(): string {
  const now = new Date();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getUTCFullYear());
  return `${mm}${yyyy}`;
}

/** Builds the bulk-download URL for a given "MMYYYY" month, e.g. "072026"
 * for July 2026 -- the file is always named "01" + month + year. */
export function monthlyFileUrl(month: string): string {
  if (!/^\d{6}$/.test(month)) {
    throw new TenderSyncError(`Invalid month "${month}" -- expected MMYYYY, e.g. "072026"`);
  }
  return `${DOWNLOAD_BASE}?fileName=01${month}.json`;
}

export async function fetchMonthlyReleases(month: string): Promise<OcdsReleasePackage> {
  const url = monthlyFileUrl(month);
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    throw new TenderSyncError(`Failed to reach the eTenders bulk file for ${month}: ${(err as Error).message}`);
  }
  if (!res.ok) {
    throw new TenderSyncError(
      res.status === 404
        ? `No bulk file published yet for ${month}`
        : `eTenders bulk file request failed: ${res.status}`,
    );
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new TenderSyncError(`eTenders bulk file for ${month} was not valid JSON`);
  }
  const pkg = body as Partial<OcdsReleasePackage>;
  if (!Array.isArray(pkg.Releases)) {
    throw new TenderSyncError(`eTenders bulk file for ${month} had no Releases array`);
  }
  return pkg as OcdsReleasePackage;
}

export type SyncResult = {
  fetched: number;
  inserted: number;
  updated: number;
  unmatchedProvince: number;
};

/**
 * Syncs one month of tenders into the global `tenders` table. Uses the
 * service-role client (tenders has RLS-enabled with zero authenticated write
 * policies -- see the migration), the same pattern already used by
 * src/app/api/admin/tenants/route.ts for its own RLS-locked insert.
 *
 * Never a partial write on a fetch/parse failure -- the error is thrown
 * before any database call is made.
 */
export async function syncTenders(
  admin: SupabaseClient<Database>,
  month: string = currentMonthParam(),
): Promise<SyncResult> {
  const pkg = await fetchMonthlyReleases(month);
  const deduped = dedupeByOcid(pkg.Releases);
  const rows = deduped.map(normalizeRelease);

  if (rows.length === 0) {
    return { fetched: pkg.Releases.length, inserted: 0, updated: 0, unmatchedProvince: 0 };
  }

  const ocids = rows.map((r) => r.ocid);
  const { data: existing, error: existingError } = await admin
    .from("tenders")
    .select("ocid")
    .in("ocid", ocids);

  if (existingError) {
    throw new TenderSyncError(`Failed to check existing tenders: ${existingError.message}`);
  }

  const existingSet = new Set((existing ?? []).map((r) => r.ocid));
  const insertedCount = rows.filter((r) => !existingSet.has(r.ocid)).length;
  const updatedCount = rows.length - insertedCount;
  const unmatchedProvince = rows.filter((r) => r.province_guess === null).length;

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await admin.from("tenders").upsert(chunk, { onConflict: "ocid" });
    if (error) {
      throw new TenderSyncError(`Upsert failed for batch starting at ${i}: ${error.message}`);
    }
  }

  return {
    fetched: pkg.Releases.length,
    inserted: insertedCount,
    updated: updatedCount,
    unmatchedProvince,
  };
}
