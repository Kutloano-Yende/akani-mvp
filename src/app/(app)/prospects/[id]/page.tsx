import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, OpportunityBadge } from "@/components/status-badge";
import { StatusActions } from "./status-actions";
import { AssignProspect } from "./assign-prospect";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canModifyProspect } from "@/lib/auth/prospect-access";

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: prospect } = await supabase
    .from("prospects")
    .select("*, companies(*)")
    .eq("id", id)
    .single();

  if (!prospect) notFound();

  const company = Array.isArray(prospect.companies) ? prospect.companies[0] : prospect.companies;

  const currentUser = await getCurrentUser();
  const isManager = currentUser?.role === "admin" || currentUser?.role === "manager";
  const canAct = currentUser ? canModifyProspect(currentUser.role, currentUser.id, prospect.assigned_to) : false;

  const [
    { data: contacts },
    { data: signals },
    { data: activities },
    { data: application },
    { data: conversion },
    { data: members },
  ] =
    await Promise.all([
      supabase.from("contacts").select("*").eq("company_id", company.id),
      supabase.from("opportunity_signals").select("*").eq("company_id", company.id),
      supabase
        .from("activities")
        .select("*, profiles(name)")
        .eq("prospect_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("applications")
        .select("*")
        .eq("prospect_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("conversions")
        .select("*")
        .eq("prospect_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("profiles").select("id, name").order("name"),
    ]);

  const owner = (members ?? []).find((m) => m.id === prospect.assigned_to);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-akani-text-primary">{company.name}</h1>
          <p className="mt-1 text-sm text-akani-text-secondary">
            {company.industry} · {company.city ? `${company.city}, ` : ""}
            {company.province}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={prospect.status} />
          <OpportunityBadge level={company.opportunity_level} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">B-BBEE opportunity</h2>
            <p className="mb-4 text-xs text-akani-text-muted">
              Why this prospect was identified — based on business-data signals, not a
              determination of legal B-BBEE obligation.
            </p>
            <ul className="space-y-2">
              {(signals ?? []).map((s) => (
                <li key={s.id} className="flex items-start gap-2 text-sm text-akani-text-secondary">
                  <span className="mt-0.5 text-akani-success" aria-hidden>
                    ✓
                  </span>
                  {s.description}
                </li>
              ))}
              {(signals ?? []).length === 0 && (
                <li className="text-sm text-akani-text-muted">No signals recorded yet.</li>
              )}
            </ul>
            {prospect.qualification_status && (
              <div className="mt-4 rounded-md bg-akani-info-bg px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-akani-info">
                  Qualification notes
                </p>
                <p className="mt-0.5 text-sm text-akani-text-primary">{prospect.qualification_status}</p>
              </div>
            )}
          </section>

          {(application || conversion) && (
            <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-akani-text-primary">Application &amp; conversion</h2>
              <div className="space-y-3">
                {application && (
                  <div className="rounded-md bg-akani-warning-bg px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-akani-warning">
                      Application {application.status}
                    </p>
                    <p className="mt-0.5 text-sm text-akani-text-primary">
                      Submitted{" "}
                      {new Date(application.submitted_at).toLocaleDateString("en-ZA")}
                      {application.notes ? ` — ${application.notes}` : ""}
                    </p>
                  </div>
                )}
                {conversion && (
                  <div className="rounded-md bg-akani-success-bg px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-akani-success">
                      Paying client — {conversion.status}
                    </p>
                    <p className="mt-0.5 text-sm text-akani-text-primary">
                      {conversion.converted_at &&
                        new Date(conversion.converted_at).toLocaleDateString("en-ZA")}
                      {conversion.notes ? ` — ${conversion.notes}` : ""}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-akani-text-primary">Contacts</h2>
            <div className="space-y-4">
              {(contacts ?? []).map((c) => (
                <div key={c.id} className="border-b border-akani-card-border pb-3 last:border-0 last:pb-0">
                  <p className="font-medium text-akani-text-primary">
                    {c.first_name} {c.last_name}
                  </p>
                  <p className="text-sm text-akani-text-secondary">{c.job_title}</p>
                  <p className="mt-1 text-sm text-akani-text-secondary">
                    {c.phone && <span>{c.phone}</span>}
                    {c.phone && c.email && <span className="mx-2 text-akani-text-muted">·</span>}
                    {c.email && <span>{c.email}</span>}
                  </p>
                </div>
              ))}
              {(contacts ?? []).length === 0 && (
                <p className="text-sm text-akani-text-muted">No contacts on file.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-akani-text-primary">Activity</h2>
            <div className="space-y-3">
              {(activities ?? []).map((a) => {
                const actor = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
                return (
                  <div key={a.id} className="flex items-start justify-between text-sm">
                    <div>
                      <p className="text-akani-text-secondary">{a.description ?? a.type}</p>
                      <p className="text-xs text-akani-text-muted">{actor?.name ?? "System"}</p>
                    </div>
                    <p className="shrink-0 text-xs text-akani-text-muted">
                      {new Date(a.created_at).toLocaleDateString("en-ZA")}
                    </p>
                  </div>
                );
              })}
              {(activities ?? []).length === 0 && (
                <p className="text-sm text-akani-text-muted">No activity yet.</p>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-akani-text-primary">Actions</h2>
            {canAct ? (
              <StatusActions prospectId={prospect.id} status={prospect.status} />
            ) : (
              <p className="text-sm text-akani-text-secondary">
                This prospect is assigned to {owner?.name ?? "another team member"}. Only they, or a
                manager, can change it.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-akani-text-primary">Owner</h2>
            {isManager ? (
              <AssignProspect
                prospectId={prospect.id}
                assignedTo={prospect.assigned_to}
                members={members ?? []}
              />
            ) : (
              <p className="text-sm text-akani-text-secondary">{owner?.name ?? "Unassigned"}</p>
            )}
          </section>

          <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-akani-text-primary">Company details</h2>
            <dl className="space-y-2 text-sm">
              <Detail label="Registration No." value={company.registration_number} />
              <Detail label="Employees" value={company.employee_count} />
              <Detail label="Revenue" value={company.revenue_range} />
              <Detail label="Website" value={company.website} />
              <Detail label="Address" value={company.address} />
            </dl>
          </section>

          <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-akani-text-primary">Source</h2>
            <p className="text-sm text-akani-text-secondary">{company.source ?? "Manually added"}</p>
            <p className="text-xs text-akani-text-muted">
              {new Date(company.created_at).toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-akani-text-secondary">{label}</dt>
      <dd className="text-right text-akani-text-primary">{value ?? "—"}</dd>
    </div>
  );
}
