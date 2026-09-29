import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { createManualProspect, type ManualProspectRow } from "@/lib/prospects/manual-create";
import type { DedupeCandidate } from "@/lib/data/dedupe";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!rateLimit(`manual-prospect:${user.id}`, 30, 60_000).allowed) {
    return NextResponse.json({ error: "Too many attempts. Wait a minute and try again." }, { status: 429 });
  }

  const row: ManualProspectRow = await request.json();

  const { data: existing } = await supabase.from("companies").select("id, name, registration_number");
  const candidates: DedupeCandidate[] = (existing ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    registrationNumber: c.registration_number,
  }));

  const result = await createManualProspect(supabase, user.id, "Manual entry", row, candidates);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
