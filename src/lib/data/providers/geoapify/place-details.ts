const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

export function buildPlaceDetailsUrl(placeId: string, apiKey: string): string {
  const url = new URL("https://api.geoapify.com/v2/place-details");
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("id", placeId);
  return url.toString();
}

export type PlaceDetailsContact = {
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
};

type DetailsProperties = {
  contact?: { email?: string; email_other?: string; phone?: string; phone_other?: string; phone_international?: string };
  website?: string;
  website_other?: string;
  website_international?: string;
  formatted?: string;
  address_line1?: string;
};

/**
 * Extracts contact fields from a Place Details response. Fields are only
 * present "if it's present in the OpenStreetMap database" per Geoapify's
 * own docs -- Geoapify's data is itself OSM-sourced, so absence here is
 * expected and common, not an error. Every field is optional; this never
 * throws on a sparse response.
 */
export function parsePlaceDetails(payload: unknown): PlaceDetailsContact {
  const body = payload as { features?: { properties?: DetailsProperties }[] } | null;
  const props = body?.features?.[0]?.properties ?? {};
  const contact = props.contact ?? {};

  return {
    email: str(contact.email) ?? str(contact.email_other),
    phone: str(contact.phone) ?? str(contact.phone_international) ?? str(contact.phone_other),
    website: str(props.website) ?? str(props.website_international) ?? str(props.website_other),
    address: str(props.formatted) ?? str(props.address_line1),
  };
}
