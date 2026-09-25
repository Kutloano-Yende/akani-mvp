// The NEXT_PUBLIC_ names must appear literally here so Next can inline them
// into the browser bundle at build time.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return { url: url as string, anonKey: anonKey as string, missing };
}

// For code paths that can't respond gracefully: fail with a message that
// names the problem instead of an opaque library error.
export function requireSupabaseEnv() {
  const env = getSupabaseEnv();
  if (env.missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${env.missing.join(", ")}. ` +
        "Set them in your hosting provider's settings and redeploy.",
    );
  }
  return env;
}
