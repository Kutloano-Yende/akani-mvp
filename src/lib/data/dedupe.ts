/**
 * Company matching for deduplication. Provider search results carry an
 * (externalId, source) pair, but the same real-world business can show up
 * under a different pair — re-run from a different provider, re-added
 * manually, a provider reissuing IDs — so exact-ID matching alone isn't
 * enough to stop duplicate company records piling up.
 *
 * Two independent signals, either being enough to call it a match:
 *  - registration_number: SA companies have one, and it doesn't change.
 *  - normalized name: strips common entity suffixes and punctuation so
 *    "ABC Construction (Pty) Ltd" matches "ABC Construction".
 */

const ENTITY_SUFFIXES = [
  "pty ltd",
  "proprietary limited",
  "\\(pty\\) ltd",
  "ltd",
  "limited",
  "cc",
  "inc",
  "incorporated",
];

const SUFFIX_PATTERN = new RegExp(`\\b(${ENTITY_SUFFIXES.join("|")})\\b`, "gi");

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[().,]/g, " ")
    .replace(SUFFIX_PATTERN, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeRegistrationNumber(reg: string | null | undefined): string | null {
  if (!reg) return null;
  const normalized = reg.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export type DedupeCandidate = {
  id: string;
  name: string;
  registrationNumber: string | null;
};

/**
 * Finds an existing company that's probably the same business as the given
 * name/registration number, if any. Returns null when nothing matches —
 * callers decide whether "probably the same" is close enough to reuse the
 * row or just warn the user.
 */
export function findDuplicate(
  name: string,
  registrationNumber: string | null | undefined,
  candidates: DedupeCandidate[],
): DedupeCandidate | null {
  const normalizedReg = normalizeRegistrationNumber(registrationNumber);
  if (normalizedReg) {
    const regMatch = candidates.find(
      (c) => normalizeRegistrationNumber(c.registrationNumber) === normalizedReg,
    );
    if (regMatch) return regMatch;
  }

  const normalizedName = normalizeCompanyName(name);
  if (normalizedName) {
    const nameMatch = candidates.find(
      (c) => normalizeCompanyName(c.name) === normalizedName,
    );
    if (nameMatch) return nameMatch;
  }

  return null;
}
