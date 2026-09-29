import { AddProspectForm } from "./add-prospect-form";
import { ImportCsvForm } from "./import-csv-form";

export default function NewProspectPage() {
  return (
    <div className="space-y-8">
      <p className="text-sm text-akani-text-secondary">
        Add prospects you already know about — one at a time, or in bulk from a CSV. These skip straight to
        &ldquo;Qualified&rdquo;, so they&apos;re ready to add to a campaign right away.
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-akani-text-primary">Add one prospect</h2>
        <AddProspectForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-akani-text-primary">Bulk upload from CSV</h2>
        <ImportCsvForm />
      </section>
    </div>
  );
}
