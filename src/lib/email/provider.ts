export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  unsubscribeUrl: string;
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
        ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
        // RFC 8058 one-click unsubscribe, which Gmail/Yahoo expect from bulk senders.
        headers: {
          "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
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
