import { renderBrandedEmail } from "@/lib/email/branded";

export type FeedbackForEmail = {
  name: string;
  role: string;
  email: string;
  message: string;
  pagePath: string | null;
};

// Tells the team someone submitted feedback. Transactional, not bulk -- no
// unsubscribe link, same reasoning buildHostNotification (booking) uses.
export function buildFeedbackNotification(
  fb: FeedbackForEmail,
  appUrl: string,
  env: Record<string, string | undefined> = process.env,
) {
  const subject = `New feedback from ${fb.name}`;

  const details = [
    `${fb.name} (${fb.role}) submitted feedback.`,
    `Email: ${fb.email}`,
    ...(fb.pagePath ? [`Page: ${fb.pagePath}`] : []),
    "",
    fb.message,
  ].join("\n");

  const { html, text } = renderBrandedEmail({
    subject,
    bodyText: details,
    reason: "You're receiving this because you're the configured support contact for Akani.",
    unsubscribeUrl: null,
    senderName: env.EMAIL_SENDER_NAME || "Akani BEE Ratings",
    logoUrl: `${appUrl}/email/akani-logo.png`,
  });

  return { subject, html, text };
}
