import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, OpportunityBadge } from "@/components/status-badge";
import { StatusActions } from "./status-actions";

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

  const [{ data: contacts }, { data: signals }, { data: activities }, { data: application }, { data: conversion }] =
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
    ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{company.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
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
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">B-BBEE opportunity</h2>
            <p className="mb-4 text-xs text-slate-500">
              Why this prospect was identified — based on business-data signals, not a
              determination of legal B-BBEE obligation.
            </p>
            <ul className="space-y-2">
              {(signals ?? []).map((s) => (
                <li key={s.id} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-0.5 text-emerald-600" aria-hidden>
                    ✓
                  </span>
                  {s.description}
                </li>
              ))}
              {(signals ?? []).length === 0 && (
                <li className="text-sm text-slate-400">No signals recorded yet.</li>
              )}
            </ul>
            {prospect.qualification_status && (
              <div className="mt-4 rounded-md bg-blue-50 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
                  Qualification notes
                </p>
                <p className="mt-0.5 text-sm text-blue-900">{prospect.qualification_status}</p>
              </div>
            )}
          </section>

          {(application || conversion) && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Application &amp; conversion</h2>
              <div className="space-y-3">
                {application && (
                  <div className="rounded-md bg-indigo-50 px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">
                      Application {application.status}
                    </p>
                    <p className="mt-0.5 text-sm text-indigo-900">
                      Submitted{" "}
                      {new Date(application.submitted_at).toLocaleDateString("en-ZA")}
                      {application.notes ? ` — ${application.notes}` : ""}
                    </p>
                  </div>
                )}
                {conversion && (
                  <div className="rounded-md bg-emerald-50 px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                      Paying client — {conversion.status}
                    </p>
                    <p className="mt-0.5 text-sm text-emerald-900">
                      {conversion.converted_at &&
                        new Date(conversion.converted_at).toLocaleDateString("en-ZA")}
                      {conversion.notes ? ` — ${conversion.notes}` : ""}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Contacts</h2>
            <div className="space-y-4">
              {(contacts ?? []).map((c) => (
                <div key={c.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <p className="font-medium text-slate-900">
                    {c.first_name} {c.last_name}
                  </p>
                  <p className="text-sm text-slate-500">{c.job_title}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {c.phone && <span>{c.phone}</span>}
                    {c.phone && c.email && <span className="mx-2 text-slate-300">·</span>}
                    {c.email && <span>{c.email}</span>}
                  </p>
                </div>
              ))}
              {(contacts ?? []).length === 0 && (
                <p className="text-sm text-slate-400">No contacts on file.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Activity</h2>
            <div className="space-y-3">
              {(activities ?? []).map((a) => {
                const actor = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
                return (
                  <div key={a.id} className="flex items-start justify-between text-sm">
                    <div>
                      <p className="text-slate-700">{a.description ?? a.type}</p>
                      <p className="text-xs text-slate-400">{actor?.name ?? "System"}</p>
                    </div>
                    <p className="shrink-0 text-xs text-slate-400">
                      {new Date(a.created_at).toLocaleDateString("en-ZA")}
                    </p>
                  </div>
                );
              })}
              {(activities ?? []).length === 0 && (
                <p className="text-sm text-slate-400">No activity yet.</p>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Actions</h2>
            <StatusActions prospectId={prospect.id} status={prospect.status} />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Company details</h2>
            <dl className="space-y-2 text-sm">
              <Detail label="Registration No." value={company.registration_number} />
              <Detail label="Employees" value={company.employee_count} />
              <Detail label="Revenue" value={company.revenue_range} />
              <Detail label="Website" value={company.website} />
              <Detail label="Address" value={company.address} />
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Source</h2>
            <p className="text-sm text-slate-600">{company.source ?? "Manually added"}</p>
            <p className="text-xs text-slate-400">
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
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-900">{value ?? "—"}</dd>
    </div>
  );
}
