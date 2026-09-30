import { TOKEN_PATTERN } from "@/lib/unsubscribe";

// reply+<token>@<LEAD_REPLY_DOMAIN>, so an inbound reply can be matched back
// to the lead purely from the recipient address (plus-addressing), without
// needing Message-Id/References threading. Unset -> falls back to whatever
// sendEmail() already does (message.replyTo/EMAIL_REPLY_TO), same as today.
export function leadReplyToAddress(token: string, env: Record<string, string | undefined> = process.env): string | undefined {
  const domain = env.LEAD_REPLY_DOMAIN?.trim();
  return domain ? `reply+${token}@${domain}` : undefined;
}

// Pulls the lead token out of a plus-addressed recipient, e.g.
// "reply+<token>@domain" -> "<token>". Null for anything that isn't a
// plausibly plus-addressed, validly-tokened address.
export function extractLeadTokenFromRecipient(address: string): string | null {
  const [local, domain] = address.split("@");
  if (!domain) return null;
  const plusIdx = local.indexOf("+");
  if (plusIdx === -1) return null;
  const token = local.slice(plusIdx + 1);
  return TOKEN_PATTERN.test(token) ? token : null;
}

// Inbound-webhook payload shapes vary by provider and haven't been verified
// against a real delivery yet (see the plan's flagged assumption); this
// accepts the common shapes a "to" field might take -- a single address, a
// list of addresses, or a list of {email} objects -- so the route has one
// place to adjust if the real payload differs.
export function extractRecipientAddresses(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(extractRecipientAddresses);
  if (value && typeof value === "object") {
    const email = (value as Record<string, unknown>).email ?? (value as Record<string, unknown>).address;
    return typeof email === "string" ? [email] : [];
  }
  return [];
}
