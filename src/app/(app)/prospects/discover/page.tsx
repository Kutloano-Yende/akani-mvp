import { DiscoverForm } from "./discover-form";

export default function DiscoverPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Find Businesses</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search South African businesses and identify B-BBEE prospects.
        </p>
      </div>
      <DiscoverForm />
    </div>
  );
}
