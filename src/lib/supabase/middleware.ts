import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";
import { IDLE_TIMEOUT_MS, LAST_ACTIVITY_COOKIE } from "@/lib/idle-timeout";

// /auth/update-password is public for a real reason, not an oversight: a
// recovery/invite link lands here with the session in a URL *hash*
// fragment (GoTrue's only option for an admin-minted link -- there's no
// PKCE verifier anywhere for it to exchange a `code` against). The server
// never sees a hash, so the page itself has to read it client-side and
// call setSession() before any session cookie exists -- which can't
// happen if middleware already redirected the request to /login first.
const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/update-password", "/unsubscribe", "/api/unsubscribe", "/permission", "/privacy", "/terms", "/contact-support", "/api/version", "/book", "/api/public", "/api/cron", "/api/webhooks"];

export async function updateSession(request: NextRequest) {
  // Every request passes through here, so a missing variable would otherwise
  // turn the whole site into an opaque 500. Say what's wrong instead.
  const { url, anonKey, missing } = getSupabaseEnv();
  if (missing.length > 0) {
    const message = `Server misconfigured: missing environment variable(s) ${missing.join(", ")}. Set them in the hosting provider's settings and redeploy.`;
    console.error(message);
    return new NextResponse(message, {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && !isPublicPath) {
    // An admin may have suspended this user after they already signed in --
    // check on every request, not just at their next login, so suspending
    // someone actually ends their open session instead of waiting for it
    // to expire on its own.
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.status === "suspended") {
      await supabase.auth.signOut();
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("reason", "suspended");
      return redirectCarryingCookies(loginUrl, response);
    }

    // Idle timeout: last_activity is only ever refreshed by the heartbeat
    // endpoint (real mouse/keyboard/touch activity, throttled) or sign-in --
    // never by the background polling elsewhere in the app (notifications,
    // update checks) -- so this is a genuine inactivity signal, not just
    // "no requests happened." Deliberately doesn't refresh the cookie on a
    // fresh read below; only the heartbeat and sign-in do that.
    const lastActivity = request.cookies.get(LAST_ACTIVITY_COOKIE)?.value;
    if (lastActivity && Date.now() - Number(lastActivity) > IDLE_TIMEOUT_MS) {
      await supabase.from("audit_logs").insert({
        action: "SESSION_EXPIRED",
        ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        user_agent: request.headers.get("user-agent"),
      });
      await supabase.auth.signOut();
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("reason", "idle");
      const redirectResponse = redirectCarryingCookies(loginUrl, response);
      redirectResponse.cookies.delete(LAST_ACTIVITY_COOKIE);
      return redirectResponse;
    }
  }

  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

// supabase.auth.signOut() clears the session by calling the client's
// setAll callback above, which lands its Set-Cookie headers on `response` --
// but a redirect needs to be a separate NextResponse.redirect(...) object,
// which wouldn't otherwise carry those headers. Copying them over is what
// actually clears the session in the browser alongside the redirect.
function redirectCarryingCookies(url: URL, response: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}
