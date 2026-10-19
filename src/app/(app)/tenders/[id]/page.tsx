import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TenderStatusBadge, ProvinceBadge } from "@/components/tender-status-badge";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SaveTenderButton } from "../save-tender-button";
import { AssignTender } from "./assign-tender";
import { TenderNotes } from "./tender-notes";

export default async function TenderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tender } = await supabase.from("tenders").select("*").eq("id", id).maybeSingle();
  if (!tender) notFound();

  const [{ data: savedTender }, { data: members }, currentUser] = await Promise.all([
    // .limit(1) before .maybeSingle(): a platform admin's read policy spans
    // every tenant, so if more than one tenant has saved this same global
    // tender, this would otherwise match >1 row and error -- see
    // src/app/api/tenders/[id]/route.ts for the same fix with the same reasoning.
    supabase.from("saved_tenders").select("*").eq("tender_id", id).limit(1).maybeSingle(),
    supabase.from("profiles").select("id, name").order("name"),
    getCurrentUser(),
  ]);

  const isManager = currentUser?.role === "admin" || currentUser?.role === "manager";
  const owner = (members ?? []).find((m) => m.id === savedTender?.assigned_to);
  const documents = Array.isArray(tender.documents) ? (tender.documents as { title?: string; url?: string; format?: string }[]) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-akani-text-primary">{tender.title}</h1>
          <p className="mt-1 text-sm text-akani-text-secondary">
            {tender.buyer_name ?? "Unknown buyer"}
            {tender.main_procurement_category ? ` · ${tender.main_procurement_category}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TenderStatusBadge status={tender.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">Description</h2>
            <p className="mb-4 text-xs text-akani-text-muted">
              Source data is in public beta and not guaranteed to be accurate — always verify against
              the official source before relying on it for a bid decision.
            </p>
            <p className="whitespace-pre-wrap text-sm text-akani-text-secondary">
              {tender.description || "No description provided."}
            </p>
          </section>

          <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-akani-text-primary">Documents</h2>
            <div className="space-y-2">
              {documents.map((d, i) => (
                <a
                  key={i}
                  href={d.url}
                  target="_blank"
                  rel="noopener"
                  className="block text-sm font-medium text-akani-text-primary hover:text-akani-gold"
                >
                  {d.title ?? "Document"} {d.format ? `(${d.format})` : ""}
                </a>
              ))}
              {documents.length === 0 && <p className="text-sm text-akani-text-muted">No documents on file.</p>}
            </div>
            {tender.source_url && (
              <a
                href={tender.source_url}
                target="_blank"
                rel="noopener"
                className="mt-4 inline-block text-sm font-medium text-akani-gold hover:underline"
              >
                View official source →
              </a>
            )}
          </section>

          {savedTender && (
            <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-akani-text-primary">Notes</h2>
              <TenderNotes tenderId={tender.id} initialNotes={savedTender.notes} />
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-akani-text-primary">Actions</h2>
            <SaveTenderButton tenderId={tender.id} initialSaved={Boolean(savedTender)} />
          </section>

          {savedTender && (
            <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-akani-text-primary">Assigned to</h2>
              {isManager ? (
                <AssignTender tenderId={tender.id} assignedTo={savedTender.assigned_to} members={members ?? []} />
              ) : (
                <p className="text-sm text-akani-text-secondary">{owner?.name ?? "Unassigned"}</p>
              )}
            </section>
          )}

          <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-akani-text-primary">Tender details</h2>
            <dl className="space-y-2 text-sm">
              <Detail label="Buyer" value={tender.buyer_name} />
              <Detail label="Category" value={tender.main_procurement_category} />
              <Detail label="Province" value={<ProvinceBadge province={tender.province_guess} />} />
              <Detail
                label="Closing"
                value={tender.tender_period_end ? new Date(tender.tender_period_end).toLocaleString("en-ZA") : null}
              />
              <Detail
                label="Published"
                value={tender.published_date ? new Date(tender.published_date).toLocaleDateString("en-ZA") : null}
              />
            </dl>
          </section>

          <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-akani-text-primary">Source</h2>
            <p className="text-sm text-akani-text-secondary">National Treasury eTenders / OCDS Transparency Portal</p>
            <p className="text-xs text-akani-text-muted">OCID {tender.ocid}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-akani-text-secondary">{label}</dt>
      <dd className="text-right text-akani-text-primary">{value ?? "—"}</dd>
    </div>
  );
}
