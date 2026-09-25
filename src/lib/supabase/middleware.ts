import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/unsubscribe", "/api/unsubscribe", "/privacy", "/terms", "/contact-support", "/api/version"];

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

  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
