import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getAppUrl, liveModeProblem } from "@/lib/email/provider";
import { processDueLeads } from "@/lib/leads/process-due";

// Sends the follow-ups that are due. Vercel Cron calls this with
// `Authorization: Bearer $CRON_SECRET`.
export const dynamic = "force-dynamic";

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not set on the server." }, { status: 501 });
  }
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appUrl = getAppUrl(new URL(request.url).origin);
  const problem = liveModeProblem(appUrl);
  if (problem) return NextResponse.json({ error: problem }, { status: 501 });

  try {
    return NextResponse.json({ ok: true, ...(await processDueLeads(appUrl)) });
  } catch (err) {
    console.error("Lead follow-up run failed", err);
    return NextResponse.json({ error: "Follow-up run failed" }, { status: 500 });
  }
}
