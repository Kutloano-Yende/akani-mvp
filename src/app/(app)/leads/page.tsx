import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/booking/slots";
import { TOTAL_EMAILS } from "@/lib/leads/sequence";
import { LeadActions } from "./lead-actions";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-akani-info-bg text-akani-info",
  contacted: "bg-akani-info-bg text-akani-info",
  booked: "bg-akani-success-bg text-akani-success",
  replied: "bg-akani-success-bg text-akani-success",
  unsubscribed: "bg-akani-error-bg text-akani-error",
  closed: "bg-slate-100 text-akani-text-secondary",
};

const SOURCE_LABELS: Record<string, string> = {
  website: "Website form",
  permission: "Said yes",
  manual: "Added by staff",
};

export default async function LeadsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const canManage = user?.role === "admin" || user?.role === "manager";

  const [{ data: leads }, { data: settings }, { data: upcoming }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, source, name, email, phone, company_name, message, status, sequence_step, next_action_at, created_at, bookings(start_at, status)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("booking_settings").select("timezone").maybeSingle(),
    supabase
      .from("bookings")
      .select("id, start_at, leads(name, email, company_name, phone)")
      .eq("status", "confirmed")
      .gt("start_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(10),
  ]);

  const tz = settings?.timezone ?? "Africa/Johannesburg";
  const rows = leads ?? [];
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

  return (
    <div className="space-y-6">
      <p className="text-sm text-akani-text-secondary">
        People who got in touch. Each gets an instant reply, up to three follow-ups, and a link to book a call.
        The emails stop as soon as they book, reply or unsubscribe.
      </p>

      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-akani-text-primary">Upcoming calls</h2>
        {(upcoming ?? []).length === 0 ? (
          <p className="text-sm text-akani-text-muted">No calls booked yet.</p>
        ) : (
          <ul className="divide-y divide-akani-card-border">
            {(upcoming ?? []).map((b) => {
              const lead = one(b.leads);
              return (
                <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                  <span className="font-medium text-akani-text-primary">{formatDateTime(new Date(b.start_at), tz)}</span>
                  <span className="text-akani-text-secondary">
                    {lead?.name || lead?.email}
                    {lead?.company_name ? ` · ${lead.company_name}` : ""}
                    {lead?.phone ? ` · ${lead.phone}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="overflow-x-auto rounded-xl border border-akani-card-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-akani-card-border text-left text-xs uppercase tracking-wide text-akani-text-muted">
              <th className="px-6 py-3 font-medium">Lead</th>
              <th className="hidden md:table-cell px-6 py-3 font-medium">Source</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Emails</th>
              <th className="px-6 py-3 font-medium">Call</th>
              {canManage && <th className="px-6 py-3 font-medium" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const booking = (Array.isArray(l.bookings) ? l.bookings : l.bookings ? [l.bookings] : []).find(
                (b) => b.status === "confirmed",
              );
              const active = l.status === "new" || l.status === "contacted";
              return (
                <tr key={l.id} className="border-b border-akani-card-border align-top last:border-0">
                  <td className="px-6 py-3">
                    <p className="font-medium text-akani-text-primary">{l.name || l.email}</p>
                    <p className="text-akani-text-secondary">
                      {l.name ? `${l.email} · ` : ""}
                      {l.company_name ?? ""}
                      {l.phone ? ` · ${l.phone}` : ""}
                    </p>
                    {l.message && (
                      <p className="mt-1 max-w-md truncate text-xs text-akani-text-muted" title={l.message}>
                        &ldquo;{l.message}&rdquo;
                      </p>
                    )}
                  </td>
                  <td className="hidden md:table-cell px-6 py-3 text-akani-text-secondary">{SOURCE_LABELS[l.source] ?? l.source}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[l.status] ?? ""}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-akani-text-secondary">
                    {l.sequence_step} of {TOTAL_EMAILS} sent
                    {active && l.next_action_at && (
                      <p className="text-xs text-akani-text-muted">Next: {formatDateTime(new Date(l.next_action_at), tz)}</p>
                    )}
                  </td>
                  <td className="px-6 py-3 text-akani-text-secondary">
                    {booking ? formatDateTime(new Date(booking.start_at), tz) : "—"}
                  </td>
                  {canManage && (
                    <td className="px-6 py-3 text-right">
                      {l.status !== "unsubscribed" && l.status !== "closed" && <LeadActions id={l.id} status={l.status} />}
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={canManage ? 6 : 5} className="px-6 py-10 text-center text-akani-text-muted">
                  No leads yet. Add the form from Settings → Booking to your website to start receiving them.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
