import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseXlsxRecords } from "./parse-xlsx";

async function buildXlsx(rows: (string | number)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("parseXlsxRecords", () => {
  it("maps rows onto lower-cased header keys", async () => {
    const buffer = await buildXlsx([
      ["Company", "Email"],
      ["Acme", "hi@acme.com"],
    ]);
    expect(await parseXlsxRecords(buffer)).toEqual([{ company: "Acme", email: "hi@acme.com" }]);
  });

  it("returns an empty array for a header-only sheet", async () => {
    const buffer = await buildXlsx([["Company", "Email"]]);
    expect(await parseXlsxRecords(buffer)).toEqual([]);
  });

  it("skips fully blank rows", async () => {
    const buffer = await buildXlsx([
      ["Company", "Email"],
      ["Acme", "hi@acme.com"],
      [],
      ["Beta", "hi@beta.com"],
    ]);
    expect(await parseXlsxRecords(buffer)).toEqual([
      { company: "Acme", email: "hi@acme.com" },
      { company: "Beta", email: "hi@beta.com" },
    ]);
  });

  it("stringifies numeric cells", async () => {
    const buffer = await buildXlsx([
      ["Company", "Phone"],
      ["Acme", 821234567],
    ]);
    expect(await parseXlsxRecords(buffer)).toEqual([{ company: "Acme", phone: "821234567" }]);
  });
});
