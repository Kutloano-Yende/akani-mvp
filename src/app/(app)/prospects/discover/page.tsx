import { DiscoverForm } from "./discover-form";

export default function DiscoverPage() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-akani-text-secondary">
        Search South African businesses and identify B-BBEE prospects.
      </p>
      <DiscoverForm />
    </div>
  );
}
