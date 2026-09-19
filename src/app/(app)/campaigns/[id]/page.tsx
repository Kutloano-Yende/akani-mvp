import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CampaignProspectPicker } from "./campaign-prospect-picker";
import { SendCampaignButton } from "./send-campaign-button";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*, email_templates(id, name, subject)")
    .eq("id", id)
    .single();

  if (!campaign) notFound();

  const template = Array.isArray(campaign.email_templates)
    ? campaign.email_templates[0]
    : campaign.email_templates;

  const [{ data: campaignProspects }, { data: eligibleProspects }] = await Promise.all([
    supabase
      .from("campaign_prospects")
      .select("id, status, sent_at, replied_at, prospects(id, companies(name, industry))")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("prospects")
      .select("id, status, companies(name, industry)")
      .in("status", ["qualified", "contacted", "interested"]),
  ]);

  const inCampaignIds = new Set((campaignProspects ?? []).map((cp) => {
    const p = Array.isArray(cp.prospects) ? cp.prospects[0] : cp.prospects;
    return p?.id;
  }));

  const available = (eligibleProspects ?? [])
    .filter((p) => !inCampaignIds.has(p.id))
    .map((p) => {
      const company = Array.isArray(p.companies) ? p.companies[0] : p.companies;
      return { id: p.id, companyName: company?.name ?? "Unknown", industry: company?.industry ?? null };
    });

  const pendingCount = (campaignProspects ?? []).filter((cp) => cp.status === "pending").length;
  const sentCount = (campaignProspects ?? []).filter((cp) => cp.status !== "pending").length;
  const repliedCount = (campaignProspects ?? []).filter((cp) => cp.status === "replied").length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/campaigns" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
          ← Campaigns
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{campaign.name}</h1>
            {campaign.description && (
              <p className="mt-1 text-sm text-slate-500">{campaign.description}</p>
            )}
          </div>
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700">
            {campaign.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Prospects" value={(campaignProspects ?? []).length} />
        <StatCard label="Pending" value={pendingCount} />
        <StatCard label="Sent" value={sentCount} />
        <StatCard label="Replied" value={repliedCount} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Template</h2>
        {template ? (
          <div className="text-sm">
            <p className="font-medium text-slate-900">{template.name}</p>
            <p className="mt-1 text-slate-600">{template.subject}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            No template selected yet.{" "}
            <Link href="/campaigns/templates" className="text-emerald-700 hover:underline">
              Create one
            </Link>
            .
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Add prospects</h2>
          <SendCampaignButton campaignId={campaign.id} pendingCount={pendingCount} hasTemplate={!!template} />
        </div>
        <CampaignProspectPicker campaignId={campaign.id} available={available} />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Prospects in this campaign</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-6 py-3 font-medium">Company</th>
              <th className="px-6 py-3 font-medium">Industry</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Sent</th>
            </tr>
          </thead>
          <tbody>
            {(campaignProspects ?? []).map((cp) => {
              const prospect = Array.isArray(cp.prospects) ? cp.prospects[0] : cp.prospects;
              const company = prospect
                ? Array.isArray(prospect.companies)
                  ? prospect.companies[0]
                  : prospect.companies
                : null;
              return (
                <tr key={cp.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-6 py-3">
                    {prospect ? (
                      <Link href={`/prospects/${prospect.id}`} className="font-medium text-slate-900 hover:text-emerald-700">
                        {company?.name ?? "Unknown"}
                      </Link>
                    ) : (
                      "Unknown"
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-600">{company?.industry ?? "—"}</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
                      {cp.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {cp.sent_at ? new Date(cp.sent_at).toLocaleDateString("en-ZA") : "—"}
                  </td>
                </tr>
              );
            })}
            {(campaignProspects ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                  No prospects added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
