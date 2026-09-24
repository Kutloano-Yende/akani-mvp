import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { PopiaRequests } from "./popia-requests";

export default async function PopiaSettingsPage() {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    redirect("/settings/security");
  }

  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("popia_requests")
    .select("id, request_type, subject_email, subject_name, notes, status, due_at, completed_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-4xl space-y-6">
      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">POPIA data-subject requests</h2>
        <p className="mb-4 text-sm text-akani-text-secondary">
          Log access and erasure requests, export everything held about a person, or erase their
          details. Each request is due within 30 days of being logged.
        </p>
        <PopiaRequests requests={requests ?? []} />
      </section>
    </div>
  );
}
