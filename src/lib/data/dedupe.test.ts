import { describe, expect, it } from "vitest";
import { findDuplicate, normalizeCompanyName, normalizeRegistrationNumber } from "./dedupe";

describe("normalizeCompanyName", () => {
  it.each([
    ["ABC Construction (Pty) Ltd", "abc construction"],
    ["ABC Construction", "abc construction"],
    ["Mzansi  Facilities, Management CC", "mzansi facilities management"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeCompanyName(input)).toBe(expected);
  });
});

describe("normalizeRegistrationNumber", () => {
  it("strips punctuation and case", () => {
    expect(normalizeRegistrationNumber("2018/456789/07")).toBe("201845678907");
  });
  it("returns null for empty input", () => {
    expect(normalizeRegistrationNumber(" - ")).toBeNull();
    expect(normalizeRegistrationNumber(null)).toBeNull();
  });
});

describe("findDuplicate", () => {
  const candidates = [
    { id: "1", name: "ABC Construction (Pty) Ltd", registrationNumber: "2010/111111/07" },
    { id: "2", name: "Kagiso Steelworks", registrationNumber: null },
  ];

  it("matches on registration number even when the name differs", () => {
    expect(findDuplicate("Totally Different", "2010-111111-07", candidates)?.id).toBe("1");
  });

  it("matches on normalised name when there is no registration number", () => {
    expect(findDuplicate("kagiso steelworks (pty) ltd", null, candidates)?.id).toBe("2");
  });

  it("returns null when nothing matches", () => {
    expect(findDuplicate("Unrelated Co", "1999/000000/07", candidates)).toBeNull();
  });
});
