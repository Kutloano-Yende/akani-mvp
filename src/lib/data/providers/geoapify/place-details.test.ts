import { describe, expect, it } from "vitest";
import { buildPlaceDetailsUrl, parsePlaceDetails } from "./place-details";

describe("buildPlaceDetailsUrl", () => {
  it("builds a URL with the place id and api key", () => {
    const url = new URL(buildPlaceDetailsUrl("abc123", "test-key"));
    expect(url.pathname).toBe("/v2/place-details");
    expect(url.searchParams.get("id")).toBe("abc123");
    expect(url.searchParams.get("apiKey")).toBe("test-key");
  });
});

describe("parsePlaceDetails", () => {
  it("extracts contact fields with the documented fallback chains", () => {
    const payload = {
      features: [
        {
          properties: {
            contact: { email_other: "info@example.co.za", phone_international: "+27115550100" },
            website: "https://example.co.za",
            formatted: "1 Main Rd, Joburg",
          },
        },
      ],
    };
    expect(parsePlaceDetails(payload)).toEqual({
      email: "info@example.co.za",
      phone: "+27115550100",
      website: "https://example.co.za",
      address: "1 Main Rd, Joburg",
    });
  });

  it("prefers the primary field over the fallback when both exist", () => {
    const payload = {
      features: [{ properties: { contact: { email: "primary@example.co.za", email_other: "other@example.co.za" } } }],
    };
    expect(parsePlaceDetails(payload).email).toBe("primary@example.co.za");
  });

  it("returns all nulls, not a throw, for a response with no contact data", () => {
    const payload = { features: [{ properties: { name: "Example Co" } }] };
    expect(parsePlaceDetails(payload)).toEqual({ email: null, phone: null, website: null, address: null });
  });

  it("handles a completely empty/malformed response gracefully", () => {
    expect(parsePlaceDetails({})).toEqual({ email: null, phone: null, website: null, address: null });
    expect(parsePlaceDetails(null)).toEqual({ email: null, phone: null, website: null, address: null });
  });
});
