import { renderBrandedEmail } from "@/lib/email/branded";
import { localDate, zonedTimeToUtc } from "@/lib/booking/slots";

// One instant reply, then three follow-ups. Gaps are in days after the email
// that was just sent: about 1, 3 and 6 days after the lead arrived.
export const TOTAL_EMAILS = 4;
export const FOLLOW_UP_GAPS_DAYS = [1, 2, 3];

const SEND_HOUR_LOCAL = 7;
export const DEFAULT_TIMEZONE = "Africa/Johannesburg";

// When the email after `sentStep` is due, or null once the sequence is over.
// Lands on a weekday morning: a due date on a weekend rolls to Monday.
export function nextEmailAt(sentStep: number, now: Date, timeZone: string = DEFAULT_TIMEZONE): Date | null {
  if (sentStep < 1 || sentStep >= TOTAL_EMAILS) return null;
  const gap = FOLLOW_UP_GAPS_DAYS[sentStep - 1];

  const today = localDate(now, timeZone);
  let cal = new Date(Date.UTC(today.year, today.month - 1, today.day + gap));
  while ((cal.getUTCDay() || 7) > 5) cal = new Date(cal.getTime() + 86_400_000);

  return zonedTimeToUtc(cal.getUTCFullYear(), cal.getUTCMonth() + 1, cal.getUTCDate(), SEND_HOUR_LOCAL, 0, timeZone);
}

export type LeadForEmail = {
  firstName: string | null;
  companyName: string | null;
  source: string;
  token: string;
};

type StepCopy = { subject: string; preheader: string; body: string };

function copy(step: number, name: string, company: string | null, first: string | null): StepCopy {
  const about = company ? ` about ${company}` : "";
  // Subjects read oddly with a placeholder name ("..., there?"), so only address someone by a real name.
  const to = first ? `, ${first}` : "";
  switch (step) {
    case 1:
      return {
        subject: `Thanks for getting in touch${to}`,
        preheader: "The quickest way to get started is a short call.",
        body: `Hi ${name},\n\nThanks for reaching out to Akani BEE Ratings. We've received your message and we'd love to talk${about}.\n\nThe quickest way to get started is a short call. Pick a time that suits you and we'll be ready.`,
      };
    case 2:
      return {
        subject: `A time for a short call${to}?`,
        preheader: "Pick a time that suits you.",
        body: `Hi ${name},\n\nJust a quick follow-up on your enquiry. We'd still love to have a short conversation${about}.\n\nYou can pick any time that works for you below.`,
      };
    case 3:
      return {
        subject: `Still keen to talk about your B-BBEE${to}?`,
        preheader: "A short call is all it takes to get started.",
        body: `Hi ${name},\n\nWe know things get busy. If getting your B-BBEE position right is still on your list, a short call is the easiest way to get started.\n\nChoose a time below, or reply to this email with any questions.`,
      };
    default:
      return {
        subject: `One last note from us${to}`,
        preheader: "We won't keep emailing, but the door is open.",
        body: `Hi ${name},\n\nWe don't want to crowd your inbox, so this is our last message.\n\nIf you'd still like to talk, you can pick a time below. If not, no problem at all, and we wish you and your business well.`,
      };
  }
}

// The complete email for one step of the sequence, in the Akani layout with a
// "choose a time" button and a tokenised unsubscribe link.
export function buildLeadEmail(
  step: number,
  lead: LeadForEmail,
  appUrl: string,
  env: Record<string, string | undefined> = process.env,
) {
  const first = lead.firstName?.trim() || null;
  const { subject, preheader, body } = copy(step, first ?? "there", lead.companyName?.trim() || null, first);
  const bookingUrl = `${appUrl}/book/${lead.token}`;
  const unsubscribeUrl = `${appUrl}/unsubscribe/${lead.token}`;

  const reason =
    lead.source === "permission"
      ? "You're receiving this because you told Akani BEE Ratings you're happy to hear from us."
      : "You're receiving this because you contacted Akani BEE Ratings.";

  const { html, text } = renderBrandedEmail({
    subject,
    preheader,
    bodyText: body,
    buttons: [{ label: "Choose a time", url: bookingUrl, style: "primary" }],
    signOff: env.EMAIL_SIGN_OFF || "Warm regards,\nThe Akani team",
    reason,
    unsubscribeUrl,
    senderName: env.EMAIL_SENDER_NAME || "Akani BEE Ratings",
    address: env.EMAIL_FOOTER_ADDRESS || null,
    logoUrl: `${appUrl}/email/akani-logo.png`,
  });

  return { subject, html, text, bookingUrl, unsubscribeUrl };
}
