import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { parseCsvRecords } from "@/lib/csv/parse";
import { createManualProspect, validateManualRow, type ManualProspectRow } from "@/lib/prospects/manual-create";
import type { DedupeCandidate } from "@/lib/data/dedupe";

export const maxDuration = 60;

// Rows this endpoint will process in one request — kept small so a single
// upload finishes comfortably inside a serverless function's time limit
// (each row is several sequential DB round trips). Larger lists need
// splitting into more than one upload.
const MAX_ROWS = 150;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const HEADER_ALIASES: Record<string, keyof ManualProspectRow> = {
  company: "companyName",
  "company name": "companyName",
  business: "companyName",
  "business name": "companyName",
  email: "email",
  "contact email": "email",
  "first name": "firstName",
  "contact first name": "firstName",
  "last name": "lastName",
  "contact last name": "lastName",
  phone: "phone",
  "contact phone": "phone",
  "phone number": "phone",
  "job title": "jobTitle",
  title: "jobTitle",
  industry: "industry",
  province: "province",
  state: "province",
  city: "city",
  website: "website",
  domain: "website",
};

function toRow(record: Record<string, string>): ManualProspectRow {
  const row: Partial<ManualProspectRow> = {};
  for (const [header, value] of Object.entries(record)) {
    const field = HEADER_ALIASES[header];
    if (field && value) row[field] = value;
  }
  return row as ManualProspectRow;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!rateLimit(`csv-import:${user.id}`, 5, 60_000).allowed) {
    return NextResponse.json({ error: "Too many uploads. Wait a minute and try again." }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 2MB)" }, { status: 400 });
  }

  const text = await file.text();
  const records = parseCsvRecords(text);

  if (records.length === 0) {
    return NextResponse.json({ error: "No rows found in that file" }, { status: 400 });
  }
  if (records.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `That file has ${records.length} rows — please split it into batches of ${MAX_ROWS} or fewer.` },
      { status: 400 },
    );
  }

  const hasRecognizedHeader = Object.keys(records[0]).some((h) => h in HEADER_ALIASES);
  if (!hasRecognizedHeader) {
    return NextResponse.json(
      {
        error:
          "Couldn't find any recognized columns. Expected at least a company name and an email column (e.g. \"Company\", \"Email\").",
      },
      { status: 400 },
    );
  }

  const { data: existing } = await supabase.from("companies").select("id, name, registration_number");
  const candidates: DedupeCandidate[] = (existing ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    registrationNumber: c.registration_number,
  }));

  let created = 0;
  let duplicates = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = toRow(records[i]);
    const invalid = validateManualRow(row);
    if (invalid) {
      errors.push({ row: i + 2, reason: invalid }); // +2: 1-indexed, plus the header row
      continue;
    }

    const result = await createManualProspect(supabase, user.id, "CSV import", row, candidates);
    if (!result.ok) {
      errors.push({ row: i + 2, reason: result.error });
    } else if (result.alreadyExisted) {
      duplicates++;
    } else {
      created++;
    }
  }

  return NextResponse.json({ total: records.length, created, duplicates, errors });
}
