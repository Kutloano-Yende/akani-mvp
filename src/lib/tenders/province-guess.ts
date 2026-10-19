/**
 * Best-effort province inference from a tender's buyer name. There is no
 * real province/region field anywhere in the eTenders OCDS data (verified
 * against a full 690-release sample: `buyer` is always exactly
 * `{id, name}`, party addresses are always just `{countryName: "South
 * Africa"}`) -- some provincial department buyer names informally prefix
 * their province (e.g. "Limpopo - Economic Development Agency",
 * "Kwazulu Natal - Public Works (Head Office)"), but most buyers (national
 * departments, SOEs, municipalities) carry no geographic signal at all
 * (e.g. "South African National Parks", "ARMSCOR", "Hessequa Municipality").
 *
 * This MUST stay conservative: return null rather than guess, since a wrong
 * province is worse than an honest "Unknown" in a filter a sales team
 * actually relies on. Only a buyer name that STARTS WITH a known province
 * name immediately followed by a hyphen (the one pattern actually observed
 * in real data) counts as a match.
 *
 * Output values match the exact strings already used by
 * companies.province / scoreOpportunity's priorityProvinces
 * (src/lib/data/provider.ts), so a future tender<->company match can compare
 * them directly without a second normalization step.
 */

/** The 9 canonical South African province names, in the exact casing used
 * by companies.province (see src/lib/data/provider.ts's priorityProvinces)
 * -- reused by the tender filter UI's province dropdown. */
export const SA_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
] as const;

const PROVINCE_PREFIXES: { pattern: RegExp; province: string }[] = [
  { pattern: /^eastern cape\s*-/i, province: "Eastern Cape" },
  { pattern: /^free state\s*-/i, province: "Free State" },
  { pattern: /^gauteng\s*-/i, province: "Gauteng" },
  // Source data has been seen without the canonical hyphenation ("Kwazulu
  // Natal") as well as with it -- both normalize to the same canonical form.
  { pattern: /^kwa[\s-]*zulu[\s-]*natal\s*-/i, province: "KwaZulu-Natal" },
  { pattern: /^limpopo\s*-/i, province: "Limpopo" },
  { pattern: /^mpumalanga\s*-/i, province: "Mpumalanga" },
  { pattern: /^northern cape\s*-/i, province: "Northern Cape" },
  { pattern: /^north west\s*-/i, province: "North West" },
  { pattern: /^western cape\s*-/i, province: "Western Cape" },
];

export function guessProvince(buyerName: string | null | undefined): string | null {
  if (!buyerName) return null;
  const trimmed = buyerName.trim();
  for (const { pattern, province } of PROVINCE_PREFIXES) {
    if (pattern.test(trimmed)) return province;
  }
  return null;
}
