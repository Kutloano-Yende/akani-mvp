import { renderBrandedEmail } from "@/lib/email/branded";
import { sendEmail } from "@/lib/email/provider";
import { buildIcs } from "./ics";
import { formatDateTime, timezoneLabel } from "./slots";
import type { BookedSlot, CancelledBooking } from "./rpc";

const ORGANIZER_FALLBACK = "no-reply@akani.invalid";

// Builds the confirmation the lead receives: when, what to expect, a calendar
// invite, and a link to change or cancel. Pure so it can be tested.
export function buildConfirmationEmail(booked: BookedSlot, token: string, appUrl: string, env: Record<string, string | undefined> = process.env) {
  const when = formatDateTime(booked.start, booked.timezone);
  const minutes = Math.round((booked.end.getTime() - booked.start.getTime()) / 60_000);
  const name = booked.firstName?.trim() || "there";
  const manageUrl = `${appUrl}/book/${token}`;
  const subject = `Your call with ${booked.hostName} is booked: ${when}`;

  const { html, text } = renderBrandedEmail({
    subject,
    preheader: `${when} (${minutes} minutes)`,
    bodyText: `Hi ${name},\n\nYour call is booked.\n\n${when} (${timezoneLabel(booked.start, booked.timezone)}), ${minutes} minutes\n\n${booked.meetingDetails}\n\nA calendar invite is attached so it's in your diary.`,
    buttons: [{ label: "Change or cancel", url: manageUrl, style: "secondary" }],
    signOff: env.EMAIL_SIGN_OFF || "Warm regards,\nThe Akani team",
    reason: "You're receiving this because you booked a call with Akani BEE Ratings.",
    unsubscribeUrl: null,
    senderName: env.EMAIL_SENDER_NAME || "Akani BEE Ratings",
    address: env.EMAIL_FOOTER_ADDRESS || null,
    logoUrl: `${appUrl}/email/akani-logo.png`,
  });

  const ics = buildIcs({
    uid: `${booked.bookingId}@akani`,
    start: booked.start,
    end: booked.end,
    summary: `Call with ${booked.hostName}`,
    description: booked.meetingDetails,
    organizer: { name: booked.hostName, email: booked.hostEmail ?? ORGANIZER_FALLBACK },
    attendee: { name: booked.name ?? undefined, email: booked.email },
  });

  return { subject, html, text, ics };
}

// Tells the team a call was booked, with everything the lead told us.
export function buildHostNotification(booked: BookedSlot, appUrl: string, env: Record<string, string | undefined> = process.env) {
  const when = formatDateTime(booked.start, booked.timezone);
  const who = booked.name || booked.email;
  const subject = `New call booked: ${who}${booked.company ? ` (${booked.company})` : ""}, ${when}`;

  const details = [
    `${who} has booked a call.`,
    `When: ${when} (${booked.timezone})`,
    `Email: ${booked.email}`,
    ...(booked.phone ? [`Phone: ${booked.phone}`] : []),
    ...(booked.company ? [`Company: ${booked.company}`] : []),
    ...(booked.message ? [`Their message: ${booked.message}`] : []),
  ].join("\n");

  const { html, text } = renderBrandedEmail({
    subject,
    bodyText: details,
    buttons: [{ label: "Open leads", url: `${appUrl}/leads`, style: "primary" }],
    reason: "You're receiving this because you're the host for Akani call bookings.",
    unsubscribeUrl: null,
    senderName: env.EMAIL_SENDER_NAME || "Akani BEE Ratings",
    logoUrl: `${appUrl}/email/akani-logo.png`,
  });

  return { subject, html, text };
}

// Sends the lead's confirmation (with the invite attached) and the team notice.
// A delivery problem never undoes the booking itself, which is already saved.
export async function sendBookingEmails(booked: BookedSlot, token: string, appUrl: string) {
  const confirmation = buildConfirmationEmail(booked, token, appUrl);
  const toLead = await sendEmail({
    to: booked.email,
    subject: confirmation.subject,
    html: confirmation.html,
    text: confirmation.text,
    ...(booked.hostEmail ? { replyTo: booked.hostEmail } : {}),
    attachments: [
      {
        filename: "akani-call.ics",
        content: Buffer.from(confirmation.ics).toString("base64"),
        contentType: "text/calendar; method=REQUEST; charset=utf-8",
      },
    ],
  });

  let toHost: { ok: boolean; error?: string } | null = null;
  if (booked.hostEmail) {
    const note = buildHostNotification(booked, appUrl);
    toHost = await sendEmail({ to: booked.hostEmail, subject: note.subject, html: note.html, text: note.text, replyTo: booked.email });
  }

  return { toLead, toHost };
}

// After a cancellation: the lead gets a calendar update that removes the entry,
// and the team is told the slot is free again.
export async function sendCancellationEmails(cancelled: CancelledBooking, appUrl: string, env: Record<string, string | undefined> = process.env) {
  const when = formatDateTime(cancelled.start, cancelled.timezone);
  const name = cancelled.firstName?.trim() || "there";

  const lead = renderBrandedEmail({
    subject: `Your call on ${when} is cancelled`,
    bodyText: `Hi ${name},\n\nYour call on ${when} has been cancelled. If you'd like to talk another time, you're welcome to choose a new one.`,
    signOff: env.EMAIL_SIGN_OFF || "Warm regards,\nThe Akani team",
    reason: "You're receiving this because you cancelled a call with Akani BEE Ratings.",
    unsubscribeUrl: null,
    senderName: env.EMAIL_SENDER_NAME || "Akani BEE Ratings",
    logoUrl: `${appUrl}/email/akani-logo.png`,
  });
  const ics = buildIcs({
    uid: `${cancelled.bookingId}@akani`,
    start: cancelled.start,
    end: cancelled.end,
    summary: `Call with ${cancelled.hostName}`,
    organizer: { name: cancelled.hostName, email: cancelled.hostEmail ?? ORGANIZER_FALLBACK },
    attendee: { name: cancelled.name ?? undefined, email: cancelled.email },
    method: "CANCEL",
  });

  const toLead = await sendEmail({
    to: cancelled.email,
    subject: `Your call on ${when} is cancelled`,
    html: lead.html,
    text: lead.text,
    attachments: [
      {
        filename: "akani-call-cancelled.ics",
        content: Buffer.from(ics).toString("base64"),
        contentType: "text/calendar; method=CANCEL; charset=utf-8",
      },
    ],
  });

  let toHost: { ok: boolean; error?: string } | null = null;
  if (cancelled.hostEmail) {
    const who = cancelled.name || cancelled.email;
    const note = renderBrandedEmail({
      subject: `Call cancelled: ${who}, ${when}`,
      bodyText: `${who}${cancelled.company ? ` (${cancelled.company})` : ""} cancelled their call on ${when}. The slot is free again.`,
      reason: "You're receiving this because you're the host for Akani call bookings.",
      unsubscribeUrl: null,
      senderName: env.EMAIL_SENDER_NAME || "Akani BEE Ratings",
      logoUrl: `${appUrl}/email/akani-logo.png`,
    });
    toHost = await sendEmail({ to: cancelled.hostEmail, subject: `Call cancelled: ${who}, ${when}`, html: note.html, text: note.text });
  }
  return { toLead, toHost };
}
