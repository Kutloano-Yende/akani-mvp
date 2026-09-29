import { parseCsvRecords } from "@/lib/csv/parse";
import { parseXlsxRecords } from "@/lib/csv/parse-xlsx";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Dispatches to the Excel or CSV parser by file extension/type, both
// producing the same shape: rows keyed by lower-cased header.
export async function extractFileRecords(file: File): Promise<Record<string, string>[]> {
  const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.type === XLSX_MIME;
  if (isXlsx) {
    const buffer = Buffer.from(await file.arrayBuffer());
    return parseXlsxRecords(buffer);
  }
  return parseCsvRecords(await file.text());
}
