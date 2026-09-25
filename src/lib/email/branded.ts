import { escapeHtml } from "./render";

// Official Akani BEE Ratings colours (logo detail sheet: Blue RGB 5-0-88, Gold
// RGB 206-155-1). Email clients ignore CSS variables, so values are inline. The
// brand typeface (Biome) isn't available in email, so a system sans stands in.
const C = {
  navy: "#050058",
  ink: "#26254a",
  muted: "#6c6b85",
  gold: "#ce9b01",
  page: "#f4f4f8",
  panel: "#f8f8fb",
  border: "#e3e3ed",
  white: "#ffffff",
};
const FONT = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";

export type EmailButton = { label: string; url: string; style?: "primary" | "secondary" };

export type BrandedEmailInput = {
  subject: string;
  // Short line shown next to the subject in the inbox list.
  preheader?: string;
  // Plain text from the template author; blank lines become paragraphs.
  bodyText: string;
  buttons?: EmailButton[];
  // Renders the "may we keep in touch?" panel with Yes / No buttons.
  permission?: { yesUrl: string; noUrl: string };
  signOff?: string;
  // Why this person is receiving the email (POPIA asks for this to be clear).
  reason: string;
  unsubscribeUrl: string | null;
  senderName?: string;
  address?: string | null;
  // Absolute https URL of the logo image. Without it, a text wordmark is used.
  logoUrl?: string | null;
};

// Only http(s) links may reach an href; anything else (javascript:, data:)
// is dropped rather than trusted.
export function safeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function paragraphs(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.ink};">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

function button({ label, url, style = "primary" }: EmailButton): string {
  const href = safeUrl(url);
  if (!href) return "";
  const primary = style === "primary";
  // Padding sits on the <a> and the colour on the <td>, the combination that
  // still renders as a solid button in Outlook.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:0 10px 10px 0;"><tr><td align="center" bgcolor="${primary ? C.gold : C.white}" style="border-radius:8px;${primary ? "" : `border:2px solid ${C.navy};`}"><a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:${primary ? "14px 26px" : "12px 24px"};font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:${C.navy};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a></td></tr></table>`;
}

function header(logoUrl: string | null): string {
  if (logoUrl) {
    // Alt text is styled so the brand still reads if images are blocked.
    return `<img src="${escapeHtml(logoUrl)}" width="220" alt="Akani BEE Ratings" style="display:block;border:0;outline:none;text-decoration:none;width:220px;max-width:100%;height:auto;font-family:${FONT};font-size:20px;font-weight:800;color:${C.navy};">`;
  }
  return `<div style="font-family:${FONT};font-size:30px;font-weight:800;letter-spacing:3px;color:${C.navy};line-height:1;">AKANI</div>
<div style="margin-top:4px;font-family:${FONT};font-size:15px;font-weight:600;letter-spacing:2px;color:${C.gold};">BEE RATINGS</div>`;
}

export function renderBrandedEmail(input: BrandedEmailInput): { html: string; text: string } {
  const senderName = input.senderName ?? "Akani BEE Ratings";
  const logoUrl = input.logoUrl ? safeUrl(input.logoUrl) : null;
  const buttons = (input.buttons ?? []).map(button).join("");

  const yes = input.permission ? safeUrl(input.permission.yesUrl) : null;
  const no = input.permission ? safeUrl(input.permission.noUrl) : null;
  const permissionPanel =
    yes && no
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px 0;"><tr><td bgcolor="${C.panel}" style="padding:22px 22px 14px 22px;border:1px solid ${C.border};border-left:4px solid ${C.gold};border-radius:8px;">
<p style="margin:0 0 4px 0;font-family:${FONT};font-size:17px;font-weight:700;color:${C.navy};">May we keep in touch?</p>
<p style="margin:0 0 16px 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};">A quick yes or no is all we need. If you say no, we won&rsquo;t contact you again.</p>
${button({ label: "Yes, keep in touch", url: yes, style: "primary" })}${button({ label: "No, thanks", url: no, style: "secondary" })}
</td></tr></table>`
      : "";

  const signOff = input.signOff
    ? `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.ink};">${escapeHtml(input.signOff).replace(/\n/g, "<br>")}</p>`
    : "";

  const unsubscribeUrl = input.unsubscribeUrl ? safeUrl(input.unsubscribeUrl) : null;
  const unsubscribe = unsubscribeUrl
    ? ` <a href="${escapeHtml(unsubscribeUrl)}" style="color:${C.muted};text-decoration:underline;">Unsubscribe</a>.`
    : "";
  const address = input.address ? `<br>${escapeHtml(input.address)}` : "";

  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(input.preheader)}${"&nbsp;&zwnj;".repeat(40)}</div>`
    : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td bgcolor="${C.navy}" height="6" style="height:6px;font-size:0;line-height:0;border-radius:12px 12px 0 0;">&nbsp;</td></tr>
<tr><td bgcolor="${C.white}" style="padding:26px 32px 22px 32px;border-left:1px solid ${C.border};border-right:1px solid ${C.border};">${header(logoUrl)}</td></tr>
<tr><td bgcolor="${C.gold}" height="3" style="height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td bgcolor="${C.white}" style="padding:36px 32px 28px 32px;border-left:1px solid ${C.border};border-right:1px solid ${C.border};">
${paragraphs(input.bodyText)}
${buttons ? `<div style="margin:8px 0 8px 0;">${buttons}</div>` : ""}
${permissionPanel}
${signOff}
</td></tr>
<tr><td bgcolor="${C.white}" style="padding:0 32px 26px 32px;border-left:1px solid ${C.border};border-right:1px solid ${C.border};border-bottom:1px solid ${C.border};border-radius:0 0 12px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${C.border};padding-top:18px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};">
${escapeHtml(input.reason)}${unsubscribe}<br>Sent by ${escapeHtml(senderName)}.${address}<br>Together we build
</td></tr></table>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const textLines = [input.bodyText.trim()];
  for (const b of input.buttons ?? []) {
    const href = safeUrl(b.url);
    if (href) textLines.push(`${b.label}: ${href}`);
  }
  if (yes && no) {
    textLines.push(
      "May we keep in touch? A quick yes or no is all we need. If you say no, we won't contact you again.",
      `Yes, keep in touch: ${yes}`,
      `No, thanks: ${no}`,
    );
  }
  if (input.signOff) textLines.push(input.signOff);
  textLines.push(
    `--\n${input.reason}${unsubscribeUrl ? ` Unsubscribe: ${unsubscribeUrl}` : ""}\nSent by ${senderName}.${input.address ? `\n${input.address}` : ""}\nTogether we build`,
  );

  return { html, text: textLines.join("\n\n") };
}
