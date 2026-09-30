import { renderBrandedEmail } from "@/lib/email/branded";
import { leadReplyToAddress } from "./reply-to";

export type ReplyAckLead = { firstName: string | null; token: string };

// The one auto-sent message a lead ever gets in response to their own
// reply: a fixed, non-AI acknowledgment. No unsubscribe link -- this is a
// direct transactional reply to something the lead just sent, not a bulk
// send, the same reasoning buildConfirmationEmail (booking) already uses.
export function buildReplyAckEmail(
  lead: ReplyAckLead,
  appUrl: string,
  env: Record<string, string | undefined> = process.env,
) {
  const first = lead.firstName?.trim() || null;
  const bookingUrl = `${appUrl}/book/${lead.token}`;
  const subject = "Thanks for your reply";

  const { html, text } = renderBrandedEmail({
    subject,
    bodyText: `Hi ${first ?? "there"},\n\nThanks for getting back to us — someone from our team will be in touch shortly.\n\nIf it's easier, you're welcome to pick a time that suits you below.`,
    buttons: [{ label: "Choose a time", url: bookingUrl, style: "primary" }],
    signOff: env.EMAIL_SIGN_OFF || "Warm regards,\nThe Akani team",
    reason: "You're receiving this because you replied to an email from Akani BEE Ratings.",
    unsubscribeUrl: null,
    senderName: env.EMAIL_SENDER_NAME || "Akani BEE Ratings",
    address: env.EMAIL_FOOTER_ADDRESS || null,
    logoUrl: `${appUrl}/email/akani-logo.png`,
  });

  return { subject, html, text, replyTo: leadReplyToAddress(lead.token, env) };
}
