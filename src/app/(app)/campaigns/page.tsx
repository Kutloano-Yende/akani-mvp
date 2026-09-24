import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateCampaignForm } from "./create-campaign-form";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function CampaignsPage() {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const canManage = currentUser?.role === "admin" || currentUser?.role === "manager";

  const [{ data: campaigns }, { data: templates }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("*, email_templates(name), campaign_prospects(status)")
      .order("created_at", { ascending: false }),
    supabase.from("email_templates").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <p className="text-sm text-akani-text-secondary">
          Reach qualified prospects with templated outreach.
        </p>
        <Link
          href="/campaigns/templates"
          className="rounded-md border border-akani-card-border px-4 py-2 text-sm font-medium text-akani-text-primary hover:bg-akani-page-bg"
        >
          Manage templates
        </Link>
      </div>

      {canManage ? (
        <CreateCampaignForm templates={templates ?? []} />
      ) : (
        <p className="rounded-md bg-akani-info-bg px-3 py-2 text-sm text-akani-info">
          Campaigns are created and sent by managers and admins. You can view their progress here.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-akani-card-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-akani-card-border text-left text-xs uppercase tracking-wide text-akani-text-muted">
              <th className="px-6 py-3 font-medium">Campaign</th>
              <th className="px-6 py-3 font-medium">Template</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Prospects</th>
              <th className="px-6 py-3 font-medium">Sent</th>
              <th className="px-6 py-3 font-medium">Replied</th>
            </tr>
          </thead>
          <tbody>
            {(campaigns ?? []).map((c) => {
              const template = Array.isArray(c.email_templates)
                ? c.email_templates[0]
                : c.email_templates;
              const prospects = c.campaign_prospects ?? [];
              const sent = prospects.filter((p) => p.status !== "pending").length;
              const replied = prospects.filter((p) => p.status === "replied").length;
              return (
                <tr key={c.id} className="border-b border-akani-card-border last:border-0 hover:bg-akani-page-bg">
                  <td className="px-6 py-3">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="font-medium text-akani-text-primary hover:text-akani-gold"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-akani-text-secondary">{template?.name ?? "—"}</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-akani-text-secondary">
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-akani-text-secondary">{prospects.length}</td>
                  <td className="px-6 py-3 text-akani-text-secondary">{sent}</td>
                  <td className="px-6 py-3 text-akani-text-secondary">{replied}</td>
                </tr>
              );
            })}
            {(campaigns ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-akani-text-muted">
                  No campaigns yet. Create one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
