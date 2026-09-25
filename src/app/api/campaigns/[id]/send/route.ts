import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";
import { getAppUrl, getEmailMode, sendEmail } from "@/lib/email/provider";
import { escapeHtml, renderSubject, renderTemplate, textToHtml } from "@/lib/email/render";

/**
 * Sends pending campaign emails. With RESEND_API_KEY + EMAIL_FROM configured
 * these are real emails; otherwise delivery is simulated so the campaign
 * lifecycle can still be exercised end-to-end.
 *
 * Either way, the checks that matter for compliance are real: recipients on
 * the suppression list (by contact OR company address) are skipped, and every
 * email carries a working one-click unsubscribe link tied to that recipient.
 * A row is only marked sent after its email is accepted, so a failure or a
 * dropped request never records a send that didn't happen.
 */
const BATCH_LIMIT = 50;
// Resend's default limit is 2 requests/second.
const LIVE_SEND_DELAY_MS = 600;

export async function POST(
  request: Request,
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

  const mode = getEmailMode();
  const appUrl = getAppUrl(new URL(request.url).origin);
  if (mode === "live" && (!process.env.APP_URL || !appUrl.startsWith("https://"))) {
    return NextResponse.json(
      {
        error:
          "Live sending needs APP_URL set to this app's public https address, so unsubscribe links work for recipients.",
      },
      { status: 501 },
    );
  }

  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("id", campaign.template_id)
    .single();
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 400 });
  }

  const { data: pending } = await supabase
    .from("campaign_prospects")
    .select(
      "id, prospect_id, unsubscribe_token, prospects(companies(name, email, contacts(first_name, email)))",
    )
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

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

  const one = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

  type Plan = {
    row: (typeof pending)[number];
    to: string | null;
    firstName: string;
    companyName: string;
    suppressed: boolean;
  };

  const plans: Plan[] = pending.map((row) => {
    const company = one(one(row.prospects)?.companies);
    const contacts = Array.isArray(company?.contacts) ? company.contacts : [];
    const contact = contacts.find((c) => c.email) ?? null;
    const to = (contact?.email ?? company?.email ?? "").trim().toLowerCase() || null;
    // A suppressed address on either the contact or the company blocks the send.
    const candidates = [contact?.email, company?.email].map((e) => e?.trim().toLowerCase());
    return {
      row,
      to,
      firstName: contact?.first_name?.trim() || "there",
      companyName: company?.name ?? "your company",
      suppressed: candidates.some((e) => e && suppressedEmails.has(e)),
    };
  });

  const noEmail = plans.filter((p) => !p.to && !p.suppressed);
  const skipped = plans.filter((p) => p.suppressed);
  const sendable = plans.filter((p) => p.to && !p.suppressed);
  const batch = sendable.slice(0, BATCH_LIMIT);

  if (batch.length === 0) {
    return NextResponse.json(
      {
        error:
          skipped.length > 0 && noEmail.length === 0
            ? "Every pending prospect's contact email is on the suppression list."
            : "None of the pending prospects have an email address on file.",
      },
      { status: 400 },
    );
  }

  const sent: Plan[] = [];
  const failed: { plan: Plan; error: string }[] = [];

  for (const plan of batch) {
    const vars = { firstName: plan.firstName, companyName: plan.companyName };
    const unsubscribeUrl = `${appUrl}/unsubscribe/${plan.row.unsubscribe_token}`;
    const body = renderTemplate(template.body, vars);
    const footer = `You're receiving this because ${plan.companyName} was identified as a possible fit for Akani's services. To stop receiving these emails, unsubscribe here: ${unsubscribeUrl}`;

    const result = await sendEmail({
      to: plan.to!,
      subject: renderSubject(template.subject, vars),
      text: `${body}\n\n--\n${footer}`,
      html: `${textToHtml(body)}\n<hr>\n<p style="color:#667085;font-size:12px">You're receiving this because ${escapeHtml(plan.companyName)} was identified as a possible fit for Akani's services. <a href="${unsubscribeUrl}">Unsubscribe</a></p>`,
      unsubscribeUrl,
    });

    if (!result.ok) {
      failed.push({ plan, error: result.error });
    } else {
      sent.push(plan);
      const { error: updateError } = await supabase
        .from("campaign_prospects")
        .update({ status: "sent", sent_at: new Date().toISOString(), recipient_email: plan.to })
        .eq("id", plan.row.id);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    if (mode === "live") await new Promise((r) => setTimeout(r, LIVE_SEND_DELAY_MS));
  }

  if (sent.length > 0) {
    const now = new Date().toISOString();
    await supabase
      .from("campaigns")
      .update({ status: "active", started_at: campaign.started_at ?? now })
      .eq("id", campaignId);
  }

  const activities = [
    ...sent.map((p) => ({
      prospect_id: p.row.prospect_id,
      user_id: user.id,
      type: "EMAIL_SENT",
      description: mode === "live" ? "Campaign email sent" : "Campaign email sent (simulated)",
    })),
    ...failed.map((f) => ({
      prospect_id: f.plan.row.prospect_id,
      user_id: user.id,
      type: "EMAIL_FAILED",
      description: `Campaign email failed — ${f.error}`,
    })),
    ...skipped.map((p) => ({
      prospect_id: p.row.prospect_id,
      user_id: user.id,
      type: "EMAIL_SUPPRESSED",
      description: "Skipped — contact is on the suppression list",
    })),
  ];
  if (activities.length > 0) await supabase.from("activities").insert(activities);

  await logAudit(supabase, {
    action: "CAMPAIGN_SENT",
    entityType: "campaign",
    entityId: campaignId,
    metadata: {
      mode,
      sent: sent.length,
      failed: failed.length,
      suppressed: skipped.length,
      noEmail: noEmail.length,
    },
  });

  return NextResponse.json({
    mode,
    sent: sent.length,
    failed: failed.length,
    firstError: failed[0]?.error ?? null,
    suppressed: skipped.length,
    noEmail: noEmail.length,
    remaining: sendable.length - batch.length,
  });
}
