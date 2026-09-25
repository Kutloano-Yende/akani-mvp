import { createClient } from "@/lib/supabase/server";

export const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (!TOKEN_PATTERN.test(token)) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unsubscribe_by_token", { p_token: token });
  return !error && data === true;
}
