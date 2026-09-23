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
      <p className="text-sm text-akani-text-secondary">Drag a card to move it to the next stage.</p>
      <PipelineBoard initialCards={cards} />
    </div>
  );
}
