import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateCampaignForm } from "./create-campaign-form";

export default async function CampaignsPage() {
  const supabase = await createClient();

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
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Campaigns</h1>
          <p className="mt-1 text-sm text-slate-500">
            Reach qualified prospects with templated outreach.
          </p>
        </div>
        <Link
          href="/campaigns/templates"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Manage templates
        </Link>
      </div>

      <CreateCampaignForm templates={templates ?? []} />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
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
                <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="font-medium text-slate-900 hover:text-emerald-700"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-slate-600">{template?.name ?? "—"}</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-600">{prospects.length}</td>
                  <td className="px-6 py-3 text-slate-600">{sent}</td>
                  <td className="px-6 py-3 text-slate-600">{replied}</td>
                </tr>
              );
            })}
            {(campaigns ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
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
