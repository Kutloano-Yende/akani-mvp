import { renderBrandedEmail } from "./branded";
import { renderSubject, renderTemplate } from "./render";

export type CampaignTemplate = {
  subject: string;
  body: string;
  include_permission_buttons: boolean;
};

export type CampaignRecipient = {
  firstName: string;
  companyName: string;
  // The per-recipient token that authorises unsubscribe and permission links.
  token: string;
};

// Builds the complete email for one recipient of a campaign: personalised
// subject and body in the Akani layout, a tokenised unsubscribe link, and, if
// the template asks, the Yes / No permission buttons.
export function buildCampaignEmail(
  template: CampaignTemplate,
  recipient: CampaignRecipient,
  appUrl: string,
  env: Record<string, string | undefined> = process.env,
) {
  const vars = { firstName: recipient.firstName, companyName: recipient.companyName };
  const unsubscribeUrl = `${appUrl}/unsubscribe/${recipient.token}`;
  const subject = renderSubject(template.subject, vars);

  const { html, text } = renderBrandedEmail({
    subject,
    preheader: template.include_permission_buttons ? "A quick yes or no is all we need." : undefined,
    bodyText: renderTemplate(template.body, vars),
    permission: template.include_permission_buttons
      ? {
          yesUrl: `${appUrl}/permission/${recipient.token}?answer=yes`,
          noUrl: `${appUrl}/permission/${recipient.token}?answer=no`,
        }
      : undefined,
    signOff: env.EMAIL_SIGN_OFF || "Warm regards,\nThe Akani team",
    reason: `You're receiving this because ${recipient.companyName} was identified as a possible fit for Akani's B-BBEE services.`,
    unsubscribeUrl,
    senderName: env.EMAIL_SENDER_NAME || "Akani BEE Ratings",
    logoUrl: `${appUrl}/email/akani-logo.png`,
    address: env.EMAIL_FOOTER_ADDRESS || null,
  });

  return { subject, html, text, unsubscribeUrl };
}
