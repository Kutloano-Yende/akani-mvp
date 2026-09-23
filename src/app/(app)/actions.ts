"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export async function signOut() {
  const supabase = await createClient();
  // Log before signing out — once the session is cleared, this client is
  // no longer authenticated and the audit_logs insert policy would reject it.
  await logAudit(supabase, { action: "SIGN_OUT" });
  await supabase.auth.signOut();
  redirect("/login");
}
