import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  SIGN_IN: "Signed in",
  SIGN_OUT: "Signed out",
  MFA_ENABLED: "Enabled 2FA",
  MFA_DISABLED: "Disabled 2FA",
  ROLE_CHANGED: "Changed role",
  USER_INVITED: "Invited user",
  SUPPRESSION_ADDED: "Added suppression",
  SUPPRESSION_REMOVED: "Removed suppression",
  PROSPECT_ASSIGNED: "Assigned prospect",
  MFA_RESET: "Reset user's 2FA",
  POPIA_REQUEST_LOGGED: "Logged POPIA request",
  POPIA_REQUEST_COMPLETED: "Completed POPIA request",
  POPIA_REQUEST_REJECTED: "Rejected POPIA request",
  POPIA_DATA_EXPORTED: "Exported subject data",
  POPIA_ERASURE_COMPLETED: "Erased subject data",
  PROSPECTS_EXPORTED: "Exported prospects",
  AUDIT_LOGS_EXPORTED: "Exported audit logs",
};

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    redirect("/settings/security");
  }

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data: logs, count } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, metadata, ip_address, created_at, user_id, profiles(name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div className="max-w-4xl space-y-4">
      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">Audit log</h2>
            <p className="text-sm text-akani-text-secondary">
              A record of security-relevant actions across the account. This log is append-only.
            </p>
          </div>
          <a
            href="/api/export/audit-logs"
            className="shrink-0 rounded-md border border-akani-card-border px-3 py-1.5 text-sm font-medium text-akani-text-primary hover:bg-akani-page-bg"
          >
            Export CSV
          </a>
        </div>

        <div className="overflow-x-auto">
<table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-akani-card-border text-akani-text-muted">
              <th className="py-2 font-medium">When</th>
              <th className="py-2 font-medium">Who</th>
              <th className="py-2 font-medium">Action</th>
              <th className="hidden md:table-cell py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((log) => (
              <tr key={log.id} className="border-b border-akani-card-border last:border-0 align-top">
                <td className="py-3 whitespace-nowrap text-akani-text-secondary">
                  {new Date(log.created_at).toLocaleString("en-ZA")}
                </td>
                <td className="py-3 text-akani-text-primary">
                  {(log.profiles as { name: string } | null)?.name ?? "System"}
                </td>
                <td className="py-3 text-akani-text-primary">
                  {ACTION_LABELS[log.action] ?? log.action}
                </td>
                <td className="hidden md:table-cell py-3 text-akani-text-muted">
                  {log.entity_type && (
                    <span>
                      {log.entity_type}
                      {log.entity_id ? ` · ${log.entity_id.slice(0, 8)}` : ""}
                    </span>
                  )}
                  {log.metadata != null && (
                    <span className="ml-2 font-mono text-xs">{JSON.stringify(log.metadata)}</span>
                  )}
                </td>
              </tr>
            ))}
            {(logs ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-akani-text-muted">
                  No activity recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
</div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-akani-text-secondary">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <a className="text-akani-gold hover:underline" href={`/settings/audit-logs?page=${page - 1}`}>
                  Previous
                </a>
              )}
              {page < totalPages && (
                <a className="text-akani-gold hover:underline" href={`/settings/audit-logs?page=${page + 1}`}>
                  Next
                </a>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
