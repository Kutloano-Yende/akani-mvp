type Cell = string | number | boolean | null | undefined;

// Spreadsheet apps execute cells starting with = + - @ (or tab/CR) as
// formulas, so untrusted text like a company name could run on open. A
// leading apostrophe forces it to be treated as plain text.
function escapeCell(value: Cell) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: Cell[][]) {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(csv: string, filename: string) {
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
