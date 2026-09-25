import { createClient } from "@/lib/supabase/server";
import { TOKEN_PATTERN } from "@/lib/unsubscribe";

export type PermissionAnswer = "yes" | "no";

export type PermissionResult = {
  changed: boolean;
  answer: PermissionAnswer;
  email: string;
  firstName: string | null;
  company: string | null;
  prospectId: string;
};

export function parseAnswer(value: string | undefined | null): PermissionAnswer | null {
  return value === "yes" || value === "no" ? value : null;
}

// Records the recipient's answer via the token in their email. Returns null for
// an unknown or malformed token.
export async function answerPermission(
  token: string,
  answer: PermissionAnswer,
): Promise<PermissionResult | null> {
  if (!TOKEN_PATTERN.test(token)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("answer_permission", { p_token: token, p_answer: answer });
  if (error || !data || typeof data !== "object" || Array.isArray(data) || data.ok !== true) return null;

  return {
    changed: data.changed === true,
    answer,
    email: String(data.email),
    firstName: typeof data.first_name === "string" ? data.first_name : null,
    company: typeof data.company === "string" ? data.company : null,
    prospectId: String(data.prospect_id),
  };
}
