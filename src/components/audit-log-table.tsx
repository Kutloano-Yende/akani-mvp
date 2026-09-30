export const ACTION_LABELS: Record<string, string> = {
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
  AVATAR_UPDATED: "Updated profile picture",
  AVATAR_REMOVED: "Removed profile picture",
  TENANT_CREATED: "Created tenant",
  TENANT_SUSPENDED: "Suspended tenant",
  TENANT_REACTIVATED: "Reactivated tenant",
  TENANT_BRANDING_GRANTED: "Granted custom branding",
  TENANT_BRANDING_REVOKED: "Revoked custom branding",
  TENANT_BRANDING_COLORS_UPDATED: "Updated brand colors",
  TENANT_BRANDING_LOGO_UPDATED: "Updated brand logo",
  TENANT_BRANDING_LOGO_REMOVED: "Removed brand logo",
  TENANT_APPEARANCE_UPDATED: "Updated chart/layout preferences",
};

export type AuditLogRow = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
  profiles: { name: string } | { name: string }[] | null;
};

// Shared by the tenant-scoped Settings > Audit Logs page and the
// platform-wide Super Admin one — both run the same query shape and let RLS
// decide how many rows come back, so only the data source and pagination
// base path differ.
export function AuditLogTable({
  logs,
  page,
  totalPages,
  basePath,
}: {
  logs: AuditLogRow[];
  page: number;
  totalPages: number;
  basePath: string;
}) {
  return (
    <>
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
            {logs.map((log) => {
              const profile = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
              return (
                <tr key={log.id} className="border-b border-akani-card-border last:border-0 align-top">
                  <td className="py-3 whitespace-nowrap text-akani-text-secondary">
                    {new Date(log.created_at).toLocaleString("en-ZA")}
                  </td>
                  <td className="py-3 text-akani-text-primary">{profile?.name ?? "System"}</td>
                  <td className="py-3 text-akani-text-primary">{ACTION_LABELS[log.action] ?? log.action}</td>
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
              );
            })}
            {logs.length === 0 && (
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
              <a className="text-akani-gold hover:underline" href={`${basePath}?page=${page - 1}`}>
                Previous
              </a>
            )}
            {page < totalPages && (
              <a className="text-akani-gold hover:underline" href={`${basePath}?page=${page + 1}`}>
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
