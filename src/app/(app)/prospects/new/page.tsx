import { AddProspectForm } from "./add-prospect-form";
import { ImportFileForm } from "./import-file-form";

export default async function NewProspectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  // companyName: prefilled when arriving from a tender award signal (see
  // src/app/(app)/tenders/[id]/page.tsx's "Create prospect" link) -- a
  // manual starting point, not an auto-created prospect, since the award
  // data gives us a company name but no verified contact to go with it.
  const companyName = sp.companyName ?? "";

  return (
    <div className="space-y-8">
      <p className="text-sm text-akani-text-secondary">
        Add prospects you already know about — one at a time, or in bulk from a CSV. These skip straight to
        &ldquo;Qualified&rdquo;, so they&apos;re ready to add to a campaign right away.
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-akani-text-primary">Add one prospect</h2>
        <AddProspectForm initialCompanyName={companyName} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-akani-text-primary">Bulk upload from Excel</h2>
        <ImportFileForm />
      </section>
    </div>
  );
}
