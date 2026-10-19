import { describe, expect, it } from "vitest";
import { normalizeRelease, dedupeByOcid } from "./ocds-normalize";
import type { OcdsRelease } from "./ocds-types";

function release(overrides: Partial<OcdsRelease> = {}): OcdsRelease {
  return {
    ocid: "ocds-9t57fa-163705",
    id: "ocds-9t57fa-163705-2026-07-28",
    date: "2026-07-28T00:00:00Z",
    tag: ["compiled"],
    tender: {
      id: "163705",
      title: "Dev 06 2026 27",
      status: "active",
      mainProcurementCategory: "services",
      description: "Request to attend a conference",
      value: { amount: 0, currency: "ZAR" },
      documents: [
        {
          id: "doc-1",
          url: "https://www.etenders.gov.za/home/Download?blobName=doc-1.pdf",
          title: "Bid document",
        },
      ],
      tenderPeriod: { startDate: "2026-07-28T00:00:00Z", endDate: "2026-07-29T11:00:00Z" },
    },
    buyer: { id: "629", name: "Special Investigation Unit" },
    parties: [],
    awards: [],
    contracts: [],
    ...overrides,
  };
}

describe("normalizeRelease", () => {
  it("maps a well-formed release to the tenders row shape", () => {
    const row = normalizeRelease(release());
    expect(row.ocid).toBe("ocds-9t57fa-163705");
    expect(row.release_id).toBe("ocds-9t57fa-163705-2026-07-28");
    expect(row.tender_number).toBe("163705");
    expect(row.title).toBe("Dev 06 2026 27");
    expect(row.status).toBe("active");
    expect(row.main_procurement_category).toBe("services");
    expect(row.buyer_id).toBe("629");
    expect(row.buyer_name).toBe("Special Investigation Unit");
    expect(row.tender_period_end).toBe("2026-07-29T11:00:00Z");
    expect(row.value_amount).toBe(0);
    expect(row.source_url).toBe("https://www.etenders.gov.za/home/Download?blobName=doc-1.pdf");
  });

  it("coerces an empty mainProcurementCategory to null, never an empty string", () => {
    const row = normalizeRelease(
      release({ tender: { ...release().tender, mainProcurementCategory: "" } }),
    );
    expect(row.main_procurement_category).toBeNull();
  });

  it("derives province_guess from buyer.name, never trusting a source field", () => {
    const row = normalizeRelease(
      release({ buyer: { id: "361", name: "Limpopo - Economic Development Agency" } }),
    );
    expect(row.province_guess).toBe("Limpopo");
  });

  it("leaves province_guess null when the buyer name has no province signal", () => {
    const row = normalizeRelease(release({ buyer: { id: "617", name: "South African National Parks" } }));
    expect(row.province_guess).toBeNull();
  });

  it("handles a release with no documents and no buyer", () => {
    const row = normalizeRelease(
      release({
        buyer: undefined,
        tender: { ...release().tender, documents: [] },
      }),
    );
    expect(row.source_url).toBeNull();
    expect(row.buyer_id).toBeNull();
    expect(row.buyer_name).toBeNull();
    expect(row.province_guess).toBeNull();
  });

  it("preserves the full original release in raw", () => {
    const r = release();
    const row = normalizeRelease(r);
    expect(row.raw).toEqual(r);
  });
});

describe("dedupeByOcid", () => {
  it("keeps only the latest release for a repeated ocid", () => {
    const older = release({ date: "2026-07-01T00:00:00Z", tender: { ...release().tender, status: "active" } });
    const newer = release({ date: "2026-07-28T00:00:00Z", tender: { ...release().tender, status: "complete" } });
    const result = dedupeByOcid([older, newer]);
    expect(result).toHaveLength(1);
    expect(result[0].tender.status).toBe("complete");
  });

  it("keeps separate ocids as separate entries", () => {
    const a = release({ ocid: "ocds-9t57fa-1" });
    const b = release({ ocid: "ocds-9t57fa-2" });
    const result = dedupeByOcid([a, b]);
    expect(result).toHaveLength(2);
  });

  it("returns an empty array for no input", () => {
    expect(dedupeByOcid([])).toEqual([]);
  });
});
