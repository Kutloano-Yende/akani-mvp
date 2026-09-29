// Regenerates public/templates/prospect-import-template.xlsx. Run after
// changing the columns the CSV/Excel bulk-add importer recognizes
// (src/app/api/prospects/import-csv/route.ts's HEADER_ALIASES).
//
//   node scripts/generate-prospect-template.mjs
import ExcelJS from "exceljs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HEADERS = [
  "Company",
  "Email",
  "First Name",
  "Last Name",
  "Phone",
  "Job Title",
  "Industry",
  "Province",
  "City",
  "Website",
];

const INSTRUCTIONS = [
  "Delete this row and the example row below before uploading",
  "Required - the contact's email address",
  "Optional",
  "Optional",
  "Optional - digits only",
  "Optional - e.g. Procurement Manager",
  "Optional - e.g. Construction",
  "Optional - e.g. Gauteng",
  "Optional",
  "Optional - e.g. acme.co.za",
];

const EXAMPLE = [
  "Acme Construction",
  "jane@acme.co.za",
  "Jane",
  "Dlamini",
  "0821234567",
  "Procurement Manager",
  "Construction",
  "Gauteng",
  "Johannesburg",
  "acme.co.za",
];

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("Prospects");

sheet.addRow(HEADERS);
sheet.addRow(INSTRUCTIONS);
sheet.addRow(EXAMPLE);

sheet.getRow(1).font = { bold: true };
sheet.getRow(2).font = { italic: true, color: { argb: "FF808080" } };

sheet.columns = HEADERS.map((h) => ({ width: Math.max(h.length, 20) }));

const outPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "templates",
  "prospect-import-template.xlsx",
);
await workbook.xlsx.writeFile(outPath);
console.log(`Wrote ${outPath}`);
