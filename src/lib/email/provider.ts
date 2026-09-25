export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  // Omit for transactional emails (e.g. a booking confirmation).
  unsubscribeUrl?: string;
  replyTo?: string;
  // Base64-encoded content.
  attachments?: { filename: string; content: string; contentType?: string }[];
};

export type SendResult = { ok: true } | { ok: false; error: string };

export type EmailMode = "live" | "simulated";

// Live only when a Resend key AND a verified sender address are configured;
// otherwise sends are simulated so the campaign flow works without setup.
export function getEmailMode(): EmailMode {
  return process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? "live" : "simulated";
}

export function getAppUrl(fallbackOrigin: string) {
  return (process.env.APP_URL?.trim() || fallbackOrigin).replace(/\/+$/, "");
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  if (getEmailMode() === "simulated") return { ok: true };

  try {
    // RESEND_API_URL exists so tests can point at a local mock.
    const res = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.replyTo || process.env.EMAIL_REPLY_TO
          ? { reply_to: message.replyTo ?? process.env.EMAIL_REPLY_TO }
          : {}),
        ...(message.attachments?.length
          ? {
              attachments: message.attachments.map((a) => ({
                filename: a.filename,
                content: a.content,
                ...(a.contentType ? { content_type: a.contentType } : {}),
              })),
            }
          : {}),
        // RFC 8058 one-click unsubscribe, which Gmail/Yahoo expect from bulk senders.
        ...(message.unsubscribeUrl
          ? {
              headers: {
                "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }
          : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { ok: false, error: body?.message ?? `Email provider returned ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email provider unreachable" };
  }
}

// Live sending puts links in real inboxes, so it needs a public https address
// to point them at. Returns what's wrong, or null when all is well.
export function liveModeProblem(appUrl: string): string | null {
  if (getEmailMode() !== "live") return null;
  if (!process.env.APP_URL || !appUrl.startsWith("https://")) {
    return "Live sending needs APP_URL set to this app's public https address, so links in emails work.";
  }
  return null;
}

// In production, pretending to send would tell people (and the lead list) that
// someone was answered when no email went out. The lead-follow-up system holds
// its emails until real sending is configured. Local development keeps the
// simulation so the flow can be tried without an email account.
export function sendingUnavailable(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === "production" && !(env.RESEND_API_KEY && env.EMAIL_FROM);
}
