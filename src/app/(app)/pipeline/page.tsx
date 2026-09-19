import { createClient } from "@/lib/supabase/server";
import { PipelineBoard, type PipelineCard } from "./pipeline-board";

export default async function PipelinePage() {
  const supabase = await createClient();

  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, status, opportunity_score, companies(name, industry)")
    .neq("status", "lost")
    .order("updated_at", { ascending: false });

  const cards: PipelineCard[] = (prospects ?? []).map((p) => {
    const company = Array.isArray(p.companies) ? p.companies[0] : p.companies;
    return {
      id: p.id,
      status: p.status,
      companyName: company?.name ?? "Unknown",
      industry: company?.industry ?? null,
      opportunityScore: p.opportunity_score,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Pipeline</h1>
        <p className="mt-1 text-sm text-slate-500">Drag a card to move it to the next stage.</p>
      </div>
      <PipelineBoard initialCards={cards} />
    </div>
  );
}
