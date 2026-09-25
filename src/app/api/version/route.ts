import { NextResponse } from "next/server";

// Public and uncached: open tabs poll this to learn whether a newer
// deployment exists. Exposes only the build identifier.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
