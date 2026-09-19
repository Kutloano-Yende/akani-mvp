import type { ProviderCompany } from "./types";

export type { ProviderSearchParams, ProviderCompany, DataProvider } from "./types";
export { getProvider } from "./get-provider";

/**
 * Turns raw company data into a B-BBEE opportunity indicator: a score, a
 * level, and the specific signals that produced it (so the UI can explain
 * *why* a company was surfaced instead of just showing a number). This is
 * provider-agnostic — it runs the same way regardless of which
 * DataProvider the company came from.
 */
export function scoreOpportunity(company: ProviderCompany): {
  score: number;
  level: "low" | "medium" | "high";
  signals: { signalType: string; description: string; weight: number }[];
} {
  const signals: { signalType: string; description: string; weight: number }[] = [];
  let score = 40;

  const targetIndustries = [
    "Construction",
    "Manufacturing",
    "Engineering",
    "Facilities Management",
    "Transport & Logistics",
  ];
  if (company.industry && targetIndustries.includes(company.industry)) {
    signals.push({
      signalType: "INDUSTRY_MATCH",
      description: `${company.industry} matches target profile`,
      weight: 3,
    });
    score += 15;
  }

  if (
    company.employeeCount !== null &&
    company.employeeCount >= 50 &&
    company.employeeCount <= 200
  ) {
    signals.push({
      signalType: "COMPANY_SIZE_MATCH",
      description: "Company size matches target profile",
      weight: 2,
    });
    score += 10;
  }

  const priorityProvinces = ["Gauteng", "KwaZulu-Natal", "Western Cape"];
  if (company.province && priorityProvinces.includes(company.province)) {
    signals.push({
      signalType: "LOCATION_MATCH",
      description: "Located in a priority province",
      weight: 1,
    });
    score += 5;
  }

  if (company.contact?.email || company.email) {
    signals.push({
      signalType: "CONTACT_AVAILABLE",
      description: "Contact information available",
      weight: 1,
    });
    score += 5;
  }

  signals.push({
    signalType: "BUSINESS_ACTIVITY",
    description: "Requires qualification review",
    weight: 1,
  });

  score = Math.min(score, 99);
  const level: "low" | "medium" | "high" =
    score >= 75 ? "high" : score >= 55 ? "medium" : "low";

  return { score, level, signals };
}
