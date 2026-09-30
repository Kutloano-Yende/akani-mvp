import { createClient } from "@/lib/supabase/server";
import { AuditLogTable } from "@/components/audit-log-table";

const PAGE_SIZE = 50;

export default async function SuperAdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data: logs, count } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, metadata, created_at, profiles(name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">Audit log</h2>
          <p className="text-sm text-akani-text-secondary">A record of security-relevant actions across every tenant.</p>
        </div>
        <AuditLogTable logs={logs ?? []} page={page} totalPages={totalPages} basePath="/admin/audit-logs" />
      </section>
    </div>
  );
}
