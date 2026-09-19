/**
 * Business data provider client. Talks to BDM DataFinder (or whichever
 * provider is configured) using a server-side API key — never called from
 * the browser. Falls back to a mock catalogue when no key is configured,
 * so discovery works end-to-end before the real integration is wired in.
 */

export type ProviderSearchParams = {
  industry?: string;
  province?: string;
  employeesMin?: number;
  employeesMax?: number;
  keywords?: string;
  city?: string;
};

export type ProviderCompany = {
  externalId: string;
  source: string;
  name: string;
  registrationNumber: string | null;
  industry: string | null;
  province: string | null;
  city: string | null;
  employeeCount: number | null;
  revenueRange: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  contact: {
    firstName: string;
    lastName: string;
    jobTitle: string;
    email: string;
    phone: string;
  } | null;
};

const MOCK_CATALOGUE: ProviderCompany[] = [
  {
    externalId: "bdm-101",
    source: "BDM DataFinder",
    name: "Kagiso Steelworks",
    registrationNumber: "2017/551122/07",
    industry: "Manufacturing",
    province: "Gauteng",
    city: "Germiston",
    employeeCount: 110,
    revenueRange: "R10m - R50m",
    website: "kagisosteel.co.za",
    phone: "011 555 0201",
    email: "info@kagisosteel.co.za",
    address: "14 Steel Rd, Germiston",
    contact: {
      firstName: "Lerato",
      lastName: "Sithole",
      jobTitle: "Managing Director",
      email: "lerato@kagisosteel.co.za",
      phone: "011 555 0201",
    },
  },
  {
    externalId: "bdm-102",
    source: "BDM DataFinder",
    name: "Vuka Civils",
    registrationNumber: "2019/778899/07",
    industry: "Construction",
    province: "Gauteng",
    city: "Johannesburg",
    employeeCount: 75,
    revenueRange: "R5m - R10m",
    website: "vukacivils.co.za",
    phone: "011 555 0202",
    email: "info@vukacivils.co.za",
    address: "6 Builder St, Johannesburg",
    contact: {
      firstName: "Thabo",
      lastName: "Nkosi",
      jobTitle: "Director",
      email: "thabo@vukacivils.co.za",
      phone: "011 555 0202",
    },
  },
  {
    externalId: "bdm-103",
    source: "BDM DataFinder",
    name: "Sunrise Facilities Group",
    registrationNumber: "2014/223311/07",
    industry: "Facilities Management",
    province: "Western Cape",
    city: "Cape Town",
    employeeCount: 140,
    revenueRange: "R10m - R50m",
    website: "sunrisefacilities.co.za",
    phone: "021 555 0203",
    email: "info@sunrisefacilities.co.za",
    address: "20 Bree St, Cape Town",
    contact: {
      firstName: "Amahle",
      lastName: "Dube",
      jobTitle: "CEO",
      email: "amahle@sunrisefacilities.co.za",
      phone: "021 555 0203",
    },
  },
  {
    externalId: "bdm-104",
    source: "BDM DataFinder",
    name: "Highveld Transport Solutions",
    registrationNumber: "2013/445566/07",
    industry: "Transport & Logistics",
    province: "Mpumalanga",
    city: "Witbank",
    employeeCount: 60,
    revenueRange: "R5m - R10m",
    website: "highveldtransport.co.za",
    phone: "013 555 0204",
    email: "info@highveldtransport.co.za",
    address: "3 Rail St, Witbank",
    contact: {
      firstName: "Pieter",
      lastName: "Coetzee",
      jobTitle: "Operations Manager",
      email: "pieter@highveldtransport.co.za",
      phone: "013 555 0204",
    },
  },
  {
    externalId: "bdm-105",
    source: "BDM DataFinder",
    name: "Bontle Engineering Works",
    registrationNumber: "2016/667711/07",
    industry: "Engineering",
    province: "North West",
    city: "Rustenburg",
    employeeCount: 95,
    revenueRange: "R10m - R50m",
    website: "bontleeng.co.za",
    phone: "014 555 0205",
    email: "info@bontleeng.co.za",
    address: "9 Mine Rd, Rustenburg",
    contact: {
      firstName: "Karabo",
      lastName: "Modise",
      jobTitle: "Managing Director",
      email: "karabo@bontleeng.co.za",
      phone: "014 555 0205",
    },
  },
  {
    externalId: "bdm-106",
    source: "BDM DataFinder",
    name: "Coastal Retail Ventures",
    registrationNumber: "2015/998877/07",
    industry: "Retail",
    province: "KwaZulu-Natal",
    city: "Durban",
    employeeCount: 180,
    revenueRange: "R50m+",
    website: "coastalretail.co.za",
    phone: "031 555 0206",
    email: "info@coastalretail.co.za",
    address: "17 Marine Dr, Durban",
    contact: {
      firstName: "Nomvula",
      lastName: "Zulu",
      jobTitle: "CFO",
      email: "nomvula@coastalretail.co.za",
      phone: "031 555 0206",
    },
  },
];

export async function searchProvider(
  params: ProviderSearchParams,
): Promise<ProviderCompany[]> {
  const apiKey = process.env.BDM_DATAFINDER_API_KEY;

  if (apiKey && process.env.BDM_DATAFINDER_BASE_URL) {
    // Real integration point: call the configured provider with the
    // server-side API key. Left unimplemented until credentials and the
    // provider's request/response contract are confirmed.
    throw new Error("BDM DataFinder live integration not yet implemented");
  }

  return MOCK_CATALOGUE.filter((company) => {
    if (
      params.industry &&
      company.industry?.toLowerCase() !== params.industry.toLowerCase()
    ) {
      return false;
    }
    if (
      params.province &&
      company.province?.toLowerCase() !== params.province.toLowerCase()
    ) {
      return false;
    }
    if (
      params.employeesMin !== undefined &&
      (company.employeeCount ?? 0) < params.employeesMin
    ) {
      return false;
    }
    if (
      params.employeesMax !== undefined &&
      (company.employeeCount ?? 0) > params.employeesMax
    ) {
      return false;
    }
    if (params.city && company.city?.toLowerCase() !== params.city.toLowerCase()) {
      return false;
    }
    if (params.keywords) {
      const kw = params.keywords.toLowerCase();
      const haystack = `${company.name} ${company.industry ?? ""}`.toLowerCase();
      if (!haystack.includes(kw)) return false;
    }
    return true;
  });
}

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
