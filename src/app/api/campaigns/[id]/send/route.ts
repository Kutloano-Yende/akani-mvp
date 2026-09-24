import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

/**
 * Marks pending campaign_prospects as sent. There is no email provider
 * wired up yet (no Resend/SendGrid credentials) — this simulates delivery
 * so the campaign lifecycle and stats can be built and tested end-to-end.
 * Swap in a real send here (behind the same route contract) once a
 * provider is chosen; nothing about the campaign data model needs to
 * change for that.
 *
 * Suppression list IS enforced here for real, though — a recipient whose
 * company email is on suppression_list is skipped rather than sent to,
 * because a suppression list that isn't actually checked before sending
 * isn't compliance, it's decoration.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;
  const check = await requireRole(["admin", "manager"]);
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }
  const user = { id: check.userId };
  const supabase = await createClient();

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
    .select("id, prospect_id, prospects(companies(email))")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  if (!pending || pending.length === 0) {
    return NextResponse.json({ error: "No pending prospects to send to" }, { status: 400 });
  }

  const { data: suppressed } = await supabase
    .from("suppression_list")
    .select("email")
    .not("email", "is", null);
  const suppressedEmails = new Set(
    (suppressed ?? []).map((s) => (s.email ?? "").toLowerCase()).filter(Boolean),
  );

  const recipientEmail = (row: (typeof pending)[number]) => {
    const prospect = Array.isArray(row.prospects) ? row.prospects[0] : row.prospects;
    const company = prospect
      ? Array.isArray(prospect.companies)
        ? prospect.companies[0]
        : prospect.companies
      : null;
    return company?.email?.toLowerCase() ?? null;
  };

  const toSend = pending.filter((p) => {
    const email = recipientEmail(p);
    return !email || !suppressedEmails.has(email);
  });
  const skipped = pending.filter((p) => !toSend.includes(p));

  if (toSend.length === 0) {
    return NextResponse.json(
      { error: "Every pending prospect's contact email is on the suppression list." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("campaign_prospects")
    .update({ status: "sent", sent_at: now })
    .in(
      "id",
      toSend.map((p) => p.id),
    );

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
    toSend.map((p) => ({
      prospect_id: p.prospect_id,
      user_id: user.id,
      type: "EMAIL_SENT",
      description: "Campaign email sent",
    })),
  );

  if (skipped.length > 0) {
    await supabase.from("activities").insert(
      skipped.map((p) => ({
        prospect_id: p.prospect_id,
        user_id: user.id,
        type: "EMAIL_SUPPRESSED",
        description: "Skipped — contact is on the suppression list",
      })),
    );
  }

  return NextResponse.json({ sent: toSend.length, suppressed: skipped.length });
}
