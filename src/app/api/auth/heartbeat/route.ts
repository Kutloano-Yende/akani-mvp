import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LAST_ACTIVITY_COOKIE } from "@/lib/idle-timeout";

// Called by idle-timeout-manager.tsx on genuine user interaction, throttled
// client-side -- never by the background polling elsewhere in the app
// (notifications, update checks), which must NOT count as activity or the
// idle timeout could never fire.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(LAST_ACTIVITY_COOKIE, Date.now().toString(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return NextResponse.json({ ok: true });
}
