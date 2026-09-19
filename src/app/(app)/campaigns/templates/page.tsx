import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TemplateManager } from "./template-manager";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("email_templates")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/campaigns" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
          ← Campaigns
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Email templates</h1>
        <p className="mt-1 text-sm text-slate-500">
          Use <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{"{{firstName}}"}</code>,{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{"{{companyName}}"}</code> to
          personalise.
        </p>
      </div>
      <TemplateManager initialTemplates={templates ?? []} />
    </div>
  );
}
