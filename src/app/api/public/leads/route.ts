import { NextResponse } from "next/server";
import { getAppUrl, liveModeProblem } from "@/lib/email/provider";
import { LeadsNotConfiguredError, leadsSecret } from "@/lib/leads/db";
import { startLead } from "@/lib/leads/start";
import { originAllowed, parseLeadForm } from "@/lib/leads/validate";
import { rateLimit } from "@/lib/rate-limit";

// The public lead form endpoint. A website form posts here; the visitor gets an
// instant, branded reply with a link to book a call.

function cors(origin: string | null, allowed: boolean): Record<string, string> {
  return origin && allowed
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        Vary: "Origin",
      }
    : { Vary: "Origin" };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = originAllowed(origin, process.env.LEAD_ALLOWED_ORIGINS ?? "", new URL(request.url).origin);
  return new NextResponse(null, { status: allowed ? 204 : 403, headers: cors(origin, allowed) });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = originAllowed(origin, process.env.LEAD_ALLOWED_ORIGINS ?? "", new URL(request.url).origin);
  const headers = cors(origin, allowed);
  const respond = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers });

  if (!allowed) return respond({ error: "This site isn't allowed to send enquiries." }, 403);
  if (!leadsSecret()) return respond({ error: "Lead handling isn't configured on the server." }, 501);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`lead-ip:${ip}`, 5, 60 * 60_000).allowed || !rateLimit("lead-all", 200, 60 * 60_000).allowed) {
    return respond({ error: "Too many enquiries. Please try again later." }, 429);
  }

  let raw: Record<string, unknown>;
  try {
    const type = request.headers.get("content-type") ?? "";
    raw = type.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
  } catch {
    return respond({ error: "Couldn't read that request." }, 400);
  }

  const parsed = parseLeadForm(raw);
  // A bot that filled the hidden field is told it worked, so it doesn't retry.
  if (parsed.ok === "bot") return respond({ ok: true });
  if (!parsed.ok) return respond({ error: parsed.error }, 400);

  const appUrl = getAppUrl(new URL(request.url).origin);
  const problem = liveModeProblem(appUrl);
  if (problem) return respond({ error: problem }, 501);

  try {
    await startLead({ source: "website", ...parsed.value }, appUrl);
  } catch (err) {
    if (err instanceof LeadsNotConfiguredError) return respond({ error: err.message }, 501);
    console.error("Lead intake failed", err);
    return respond({ error: "Something went wrong. Please try again." }, 500);
  }

  // The same answer for a new lead, a repeat, or an address we won't email, so the
  // form can't be used to find out who is already on file.
  return respond({ ok: true });
}
