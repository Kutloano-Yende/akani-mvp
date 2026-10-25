import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: tender, error } = await supabase
    .from("tenders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!tender) {
    return NextResponse.json({ error: "Tender not found" }, { status: 404 });
  }

  // RLS already scopes this to the caller's own tenant for a normal user --
  // but a PLATFORM ADMIN's read policy spans every tenant, so if two
  // different tenants have both saved this same global tender, this query
  // can legitimately match more than one row for them. .limit(1) keeps
  // .maybeSingle() safe in that case (it otherwise errors on >1 row) --
  // the caller only ever needs "is there a save for MY session", and for a
  // platform admin specifically, which one of several is irrelevant here.
  const { data: savedTender } = await supabase
    .from("saved_tenders")
    .select("*")
    .eq("tender_id", id)
    .limit(1)
    .maybeSingle();

  // Award signals: see supabase/migrations/20261025090000_sprint29_tender_award_signals.sql
  // for why only supplier_name/value are selected here -- never the OCDS
  // "supplier" party's contactPoint, which is actually the buyer's own
  // contact, not the winning company's.
  const { data: awards } = await supabase
    .from("tender_awards")
    .select("supplier_name, value_amount, value_currency")
    .eq("tender_id", id);

  return NextResponse.json({ tender, savedTender: savedTender ?? null, awards: awards ?? [] });
}
