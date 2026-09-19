import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Marks pending campaign_prospects as sent. There is no email provider
 * wired up yet (no Resend/SendGrid credentials) — this simulates delivery
 * so the campaign lifecycle and stats can be built and tested end-to-end.
 * Swap in a real send here (behind the same route contract) once a
 * provider is chosen; nothing about the campaign data model needs to
 * change for that.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, status, template_id, started_at")
    .eq("id", campaignId)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (!campaign.template_id) {
    return NextResponse.json(
      { error: "Choose a template before sending this campaign" },
      { status: 400 },
    );
  }

  const { data: pending } = await supabase
    .from("campaign_prospects")
    .select("id, prospect_id")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  if (!pending || pending.length === 0) {
    return NextResponse.json({ error: "No pending prospects to send to" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("campaign_prospects")
    .update({ status: "sent", sent_at: now })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabase
    .from("campaigns")
    .update({
      status: "active",
      started_at: campaign.started_at ?? now,
    })
    .eq("id", campaignId);

  await supabase.from("activities").insert(
    pending.map((p) => ({
      prospect_id: p.prospect_id,
      user_id: user.id,
      type: "EMAIL_SENT",
      description: "Campaign email sent",
    })),
  );

  return NextResponse.json({ sent: pending.length });
}
