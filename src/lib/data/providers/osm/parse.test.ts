import { describe, expect, it } from "vitest";
import { parseElements } from "./parse";

describe("parseElements", () => {
  it("maps a real-shaped Overpass element to ProviderCompany", () => {
    const payload = {
      elements: [
        {
          type: "way",
          id: 123456,
          tags: {
            name: "Kagiso Electrical Services",
            craft: "electrician",
            "contact:website": "https://kagisoelectrical.co.za",
            website: "kagisoelectrical.co.za",
            "contact:email": "info@kagisoelectrical.co.za",
            "contact:phone": "+27 11 555 0100",
            "addr:housenumber": "12",
            "addr:street": "Main Road",
            "addr:suburb": "Kagiso",
            "addr:city": "Krugersdorp",
            "addr:state": "Gauteng",
            "addr:postcode": "1754",
          },
        },
      ],
    };

    const [company] = parseElements(payload);
    expect(company).toMatchObject({
      externalId: "way/123456",
      source: "OpenStreetMap",
      name: "Kagiso Electrical Services",
      industry: "electrician",
      province: "Gauteng",
      city: "Krugersdorp",
      // contact:website takes precedence over the bare website tag
      website: "https://kagisoelectrical.co.za",
      email: "info@kagisoelectrical.co.za",
      phone: "+27 11 555 0100",
      address: "12, Main Road, Kagiso, Krugersdorp, 1754",
      registrationNumber: null,
      employeeCount: null,
      revenueRange: null,
      contact: null,
    });
  });

  it("skips elements with no name tag", () => {
    const payload = { elements: [{ type: "node", id: 1, tags: { craft: "plumber" } }] };
    expect(parseElements(payload)).toEqual([]);
  });

  it("maps missing optional fields to null, not undefined", () => {
    const payload = { elements: [{ type: "node", id: 7, tags: { name: "Bare Business" } }] };
    const [company] = parseElements(payload);
    expect(company.website).toBeNull();
    expect(company.email).toBeNull();
    expect(company.phone).toBeNull();
    expect(company.address).toBeNull();
    expect(company.province).toBeNull();
  });

  it("falls back to shop/office/amenity/tourism for industry when no craft tag", () => {
    const payload = { elements: [{ type: "node", id: 2, tags: { name: "Corner Shop", shop: "supermarket" } }] };
    expect(parseElements(payload)[0].industry).toBe("supermarket");
  });

  it("returns an empty array for a malformed/empty payload", () => {
    expect(parseElements({})).toEqual([]);
    expect(parseElements(null)).toEqual([]);
    expect(parseElements({ elements: "not an array" })).toEqual([]);
  });
});
