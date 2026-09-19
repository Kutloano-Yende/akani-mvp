import type { DataProvider, ProviderCompany, ProviderSearchParams } from "../types";

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

/**
 * Stands in for a real business-data provider until BDM DataFinder (or
 * whichever provider Akani supplies credentials for) is wired up. Lets the
 * whole discover -> score -> import -> pipeline flow be built and tested
 * end-to-end against the same DataProvider contract the real integration
 * will fulfil.
 */
export class MockProvider implements DataProvider {
  readonly name = "Mock Catalogue";

  async search(params: ProviderSearchParams): Promise<ProviderCompany[]> {
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
      if (
        params.city &&
        company.city?.toLowerCase() !== params.city.toLowerCase()
      ) {
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
}
