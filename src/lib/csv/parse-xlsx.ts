import ExcelJS from "exceljs";

// Reads the first worksheet of an .xlsx file into the same shape
// parseCsvRecords produces: rows keyed by lower-cased header.
export async function parseXlsxRecords(buffer: Buffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's own dependency (@fast-csv) bundles an older @types/node whose
  // non-generic Buffer type TS picks up for exceljs's .d.ts, so a Buffer
  // from our project's (newer) @types/node fails structural assignability
  // even though it's the same real Buffer at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: string[][] = [];
  sheet.eachRow((row) => {
    // exceljs rows are 1-indexed; values[0] is always empty, so drop it.
    const values = (row.values as unknown[]).slice(1).map(cellToString);
    if (values.some((v) => v !== "")) rows.push(values);
  });

  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const rec: Record<string, string> = {};
    header.forEach((h, idx) => {
      rec[h] = (r[idx] ?? "").trim();
    });
    return rec;
  });
}

// A cell's raw value can be a plain string/number, or — for rich text,
// hyperlinks, and formula results — an object carrying the text elsewhere.
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const v = value as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if (typeof v.text === "string") return v.text;
    if (v.result !== undefined) return cellToString(v.result);
    return "";
  }
  return String(value).trim();
}
