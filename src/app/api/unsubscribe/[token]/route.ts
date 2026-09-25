import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { unsubscribeByToken } from "@/lib/unsubscribe";

// RFC 8058 one-click endpoint: mail providers POST here when a recipient
// clicks "Unsubscribe" in their mail client, with no page load involved.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`unsubscribe:${ip}`, 30, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { token } = await params;
  const ok = await unsubscribeByToken(token);
  return NextResponse.json({ success: ok }, { status: ok ? 200 : 404 });
}
