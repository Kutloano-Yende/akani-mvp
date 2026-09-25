import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { CampaignProspectPicker } from "./campaign-prospect-picker";
import { SendCampaignButton } from "./send-campaign-button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getEmailMode } from "@/lib/email/provider";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const canManage = currentUser?.role === "admin" || currentUser?.role === "manager";

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
        <Link href="/campaigns" className="text-sm font-medium text-akani-gold hover:text-akani-gold-bright">
          ← Campaigns
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-akani-text-primary">{campaign.name}</h1>
            {campaign.description && (
              <p className="mt-1 text-sm text-akani-text-secondary">{campaign.description}</p>
            )}
          </div>
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-akani-text-secondary">
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

      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-akani-text-primary">Template</h2>
        {template ? (
          <div className="text-sm">
            <p className="font-medium text-akani-text-primary">{template.name}</p>
            <p className="mt-1 text-akani-text-secondary">{template.subject}</p>
          </div>
        ) : (
          <p className="text-sm text-akani-text-muted">
            No template selected yet.{" "}
            <Link href="/campaigns/templates" className="text-akani-gold hover:underline">
              Create one
            </Link>
            .
          </p>
        )}
      </section>

      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-akani-text-primary">Add prospects</h2>
            {canManage && (
              <span
                title={
                  getEmailMode() === "live"
                    ? "Emails are delivered through the configured provider."
                    : "No email provider configured (RESEND_API_KEY / EMAIL_FROM). Sending is simulated."
                }
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  getEmailMode() === "live"
                    ? "bg-akani-success-bg text-akani-success"
                    : "bg-akani-warning-bg text-akani-warning"
                }`}
              >
                {getEmailMode() === "live" ? "Live sending" : "Simulated sending"}
              </span>
            )}
          </div>
          {canManage && (
            <SendCampaignButton campaignId={campaign.id} pendingCount={pendingCount} hasTemplate={!!template} />
          )}
        </div>
        {canManage ? (
          <CampaignProspectPicker campaignId={campaign.id} available={available} />
        ) : (
          <p className="text-sm text-akani-text-secondary">
            Only managers and admins can add prospects to or send a campaign.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-akani-card-border bg-white shadow-sm">
        <div className="border-b border-akani-card-border px-6 py-4">
          <h2 className="text-sm font-semibold text-akani-text-primary">Prospects in this campaign</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-akani-card-border text-left text-xs uppercase tracking-wide text-akani-text-muted">
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
                <tr key={cp.id} className="border-b border-akani-card-border last:border-0">
                  <td className="px-6 py-3">
                    {prospect ? (
                      <Link href={`/prospects/${prospect.id}`} className="font-medium text-akani-text-primary hover:text-akani-gold">
                        {company?.name ?? "Unknown"}
                      </Link>
                    ) : (
                      "Unknown"
                    )}
                  </td>
                  <td className="px-6 py-3 text-akani-text-secondary">{company?.industry ?? "—"}</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-akani-text-secondary">
                      {cp.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-akani-text-muted">
                    {cp.sent_at ? new Date(cp.sent_at).toLocaleDateString("en-ZA") : "—"}
                  </td>
                </tr>
              );
            })}
            {(campaignProspects ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-akani-text-muted">
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
