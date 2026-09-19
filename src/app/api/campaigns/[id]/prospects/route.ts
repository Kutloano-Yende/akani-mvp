import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prospectIds } = await request.json();
  if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
    return NextResponse.json({ error: "prospectIds must be a non-empty array" }, { status: 400 });
  }

  const { error } = await supabase.from("campaign_prospects").upsert(
    prospectIds.map((prospectId: string) => ({
      campaign_id: campaignId,
      prospect_id: prospectId,
    })),
    { onConflict: "campaign_id,prospect_id", ignoreDuplicates: true },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ added: prospectIds.length });
}
