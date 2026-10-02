import { renderBrandedEmail } from "@/lib/email/branded";

// The invite email, branded like every other Akani email instead of
// Supabase's own default template -- sent via our own pipeline (see
// invite-user.ts) using the action_link generateLink() already produced,
// so the link itself is unchanged, only how it's delivered.
export function buildInviteEmail(
  name: string,
  actionLink: string,
  appUrl: string,
  env: Record<string, string | undefined> = process.env,
) {
  const subject = "You've been invited to Akani";

  const { html, text } = renderBrandedEmail({
    subject,
    bodyText: `Hi ${name},\n\nYou've been invited to join Akani's Sales Intelligence System. Click below to set your password and get started.`,
    buttons: [{ label: "Accept invite", url: actionLink, style: "primary" }],
    signOff: env.EMAIL_SIGN_OFF || "Warm regards,\nThe Akani team",
    reason: "You're receiving this because someone at Akani invited you to join their Sales Intelligence System.",
    unsubscribeUrl: null,
    senderName: env.EMAIL_SENDER_NAME || "Akani BEE Ratings",
    address: env.EMAIL_FOOTER_ADDRESS || null,
    logoUrl: `${appUrl}/email/akani-logo.png`,
  });

  return { subject, html, text };
}
