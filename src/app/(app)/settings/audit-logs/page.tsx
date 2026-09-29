import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { AuditLogTable } from "@/components/audit-log-table";

const PAGE_SIZE = 50;

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
              A record of security-relevant actions across your tenant. This log is append-only.
            </p>
          </div>
          <a
            href="/api/export/audit-logs"
            className="shrink-0 rounded-md border border-akani-card-border px-3 py-1.5 text-sm font-medium text-akani-text-primary hover:bg-akani-page-bg"
          >
            Export CSV
          </a>
        </div>

        <AuditLogTable logs={logs ?? []} page={page} totalPages={totalPages} basePath="/settings/audit-logs" />
      </section>
    </div>
  );
}
