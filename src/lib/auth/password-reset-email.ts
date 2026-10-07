import { renderBrandedEmail } from "@/lib/email/branded";

// Sent through Akani's own branded pipeline instead of Supabase's default
// "Reset your password" template -- same reasoning as invite-email.ts.
export function buildPasswordResetEmail(
  actionLink: string,
  appUrl: string,
  env: Record<string, string | undefined> = process.env,
) {
  const subject = "Reset your Akani password";

  const { html, text } = renderBrandedEmail({
    subject,
    bodyText:
      "We received a request to reset your password. Click below to choose a new one.\n\nIf you didn't request this, you can safely ignore this email.",
    buttons: [{ label: "Reset password", url: actionLink, style: "primary" }],
    signOff: env.EMAIL_SIGN_OFF || "Warm regards,\nThe Akani team",
    reason: "You're receiving this because a password reset was requested for your Akani account.",
    unsubscribeUrl: null,
    senderName: env.EMAIL_SENDER_NAME || "Akani BEE Ratings",
    address: env.EMAIL_FOOTER_ADDRESS || null,
    logoUrl: `${appUrl}/email/akani-logo.png`,
  });

  return { subject, html, text };
}
