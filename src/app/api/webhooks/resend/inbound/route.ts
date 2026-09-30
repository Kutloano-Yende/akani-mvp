import { NextResponse } from "next/server";
import { verifySvixSignature } from "@/lib/webhooks/svix";
import { extractLeadTokenFromRecipient, extractRecipientAddresses } from "@/lib/leads/reply-to";
import { recordLeadReply, recordLeadReplyAck } from "@/lib/leads/reply";
import { buildReplyAckEmail } from "@/lib/leads/reply-ack-email";
import { buildReplyNotification } from "@/lib/booking/emails";
import { sendEmail, getAppUrl, sendingUnavailable } from "@/lib/email/provider";
import { createClient } from "@/lib/supabase/server";

// Resend's Inbound webhook for lead replies. Only ever reacts to the reply
// by stopping the follow-up sequence, auto-sending one fixed acknowledgment,
// and telling the team -- it never generates or sends any AI/free-form
// content back to the prospect.
export const dynamic = "force-dynamic";

function isInboundEvent(type: unknown): boolean {
  return typeof type !== "string" || /inbound|receiv/i.test(type);
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RESEND_WEBHOOK_SECRET is not set on the server." }, { status: 501 });
  }

  // Read as text first: signature verification is over the raw body, so
  // .json() (which consumes and re-serialises) must not run before this.
  const body = await request.text();
  const id = request.headers.get("svix-id") ?? "";
  const timestamp = request.headers.get("svix-timestamp") ?? "";
  const signatureHeader = request.headers.get("svix-signature") ?? "";

  if (!verifySvixSignature({ id, timestamp, body, signatureHeader, secret })) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const event = (payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}) as {
    type?: unknown;
    data?: Record<string, unknown>;
  };
  if (!isInboundEvent(event.type)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const recipients = extractRecipientAddresses(event.data?.to ?? (payload as Record<string, unknown>)?.to);
  const token = recipients.map(extractLeadTokenFromRecipient).find((t): t is string => t !== null);
  if (!token) {
    // Unmatched inbound mail isn't retry-worthy -- 200 so Resend doesn't redeliver it forever.
    return NextResponse.json({ ok: true, matched: false });
  }

  const result = await recordLeadReply(token);
  if (!result.ok || !result.ackNeeded) {
    return NextResponse.json({ ok: true, matched: true, ackNeeded: false });
  }

  const appUrl = getAppUrl(new URL(request.url).origin);

  if (sendingUnavailable()) {
    await recordLeadReplyAck(token, false, "Email sending isn't configured.");
  } else {
    const ack = buildReplyAckEmail({ firstName: result.firstName, token: result.token }, appUrl);
    const ackResult = await sendEmail({
      to: result.email,
      subject: ack.subject,
      html: ack.html,
      text: ack.text,
      replyTo: ack.replyTo,
    });
    await recordLeadReplyAck(token, ackResult.ok, ackResult.ok ? null : ackResult.error ?? "Send failed");

    try {
      const supabase = await createClient();
      const { data: settings } = await supabase.from("booking_settings").select("host_email").maybeSingle();
      if (settings?.host_email) {
        const notice = buildReplyNotification(
          { name: result.name, email: result.email, company: result.company },
          appUrl,
        );
        await sendEmail({ to: settings.host_email, subject: notice.subject, html: notice.html, text: notice.text });
      }
    } catch (err) {
      console.error("Lead reply notification failed", err);
    }
  }

  return NextResponse.json({ ok: true, matched: true, ackNeeded: true });
}
