import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { SuppressionList } from "./suppression-list";

export default async function SuppressionSettingsPage() {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    redirect("/settings/security");
  }

  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("suppression_list")
    .select("id, email, phone, reason, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl space-y-6">
      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">Suppression list</h2>
        <p className="mb-4 text-sm text-akani-text-secondary">
          Emails on this list are automatically skipped when sending campaigns.
        </p>
        <SuppressionList entries={entries ?? []} />
      </section>
    </div>
  );
}
