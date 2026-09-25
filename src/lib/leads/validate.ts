export type LeadFormInput = {
  name: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  message: string | null;
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim().slice(0, max);
  return t.length > 0 ? t : null;
};

// Validates and tidies what a website form sends. The honeypot ("website") is a
// field real visitors never see; a bot fills it in.
export function parseLeadForm(
  raw: Record<string, unknown>,
): { ok: true; value: LeadFormInput } | { ok: false; error: string } | { ok: "bot" } {
  if (typeof raw.website === "string" && raw.website.trim() !== "") return { ok: "bot" };

  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, error: "Please enter a valid email address." };

  const messageRaw = typeof raw.message === "string" ? raw.message.trim().slice(0, 2000) : "";

  return {
    ok: true,
    value: {
      name: clean(raw.name, 120),
      email,
      phone: clean(raw.phone, 40),
      company: clean(raw.company, 160),
      message: messageRaw.length > 0 ? messageRaw : null,
    },
  };
}

// Whether a browser request from `origin` may use the endpoint.
export function originAllowed(origin: string | null, allowedList: string, ownOrigin: string): boolean {
  if (!origin) return true; // server-to-server calls send no Origin
  if (origin === ownOrigin) return true;
  return allowedList
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean)
    .includes(origin.replace(/\/+$/, ""));
}
