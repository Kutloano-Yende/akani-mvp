import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { UsersTable } from "./users-table";
import { InviteUserForm } from "./invite-user-form";

export default async function UsersSettingsPage() {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    redirect("/settings/security");
  }

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, role, created_at")
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-3xl space-y-6">
      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">Team members</h2>
        <p className="mb-4 text-sm text-akani-text-secondary">
          Manage roles for everyone with access to Akani. Admins can see and manage suppression
          lists, audit logs, and other team members.
        </p>
        <UsersTable profiles={profiles ?? []} currentUserId={check.userId} />
      </section>

      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">Invite a team member</h2>
        <p className="mb-4 text-sm text-akani-text-secondary">
          Send an invite email so someone new can set up their own account.
        </p>
        <InviteUserForm />
      </section>
    </div>
  );
}
