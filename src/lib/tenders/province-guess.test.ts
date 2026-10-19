import { describe, expect, it } from "vitest";
import { guessProvince } from "./province-guess";

describe("guessProvince", () => {
  it.each([
    ["Limpopo - Economic Development Agency", "Limpopo"],
    ["Kwazulu Natal - Public Works (Head Office)", "KwaZulu-Natal"],
    ["KwaZulu-Natal - Health", "KwaZulu-Natal"],
    ["Eastern Cape - Cooperative Governance  and Traditional Affairs", "Eastern Cape"],
    ["Western Cape - Education", "Western Cape"],
    ["Gauteng - Treasury", "Gauteng"],
    ["North West - Agriculture", "North West"],
    ["Northern Cape - Transport", "Northern Cape"],
    ["Free State - Health", "Free State"],
    ["Mpumalanga - Education", "Mpumalanga"],
  ])("extracts the province from %s", (buyerName, expected) => {
    expect(guessProvince(buyerName)).toBe(expected);
  });

  it.each([
    "South African National Parks",
    "ARMSCOR",
    "Home Affairs",
    "Hessequa Municipality",
    "Moqhaka Local Municipality",
    "Cape Agulhas Municipality",
    "National Treasury",
  ])("returns null for a buyer name with no province signal: %s", (buyerName) => {
    expect(guessProvince(buyerName)).toBeNull();
  });

  it("returns null for a province name that only appears mid-string, not as a prefix", () => {
    expect(guessProvince("Agency serving Gauteng and beyond")).toBeNull();
  });

  it("returns null for null/undefined/empty input", () => {
    expect(guessProvince(null)).toBeNull();
    expect(guessProvince(undefined)).toBeNull();
    expect(guessProvince("")).toBeNull();
  });
});
