import { createClient } from "@/lib/supabase/server";
import { getProvider } from "@/lib/data/provider";
import { StatCard } from "@/components/stat-card";

export default async function DataProviderSettingsPage() {
  const provider = getProvider();
  const isLive = provider.name !== "Mock Catalogue";
  const supabase = await createClient();

  const [{ data: usage }, { data: recent }] = await Promise.all([
    supabase.from("api_usage").select("credits_used, results_returned"),
    supabase
      .from("api_usage")
      .select("id, created_at, results_returned, credits_used, provider, profiles(name)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const totalSearches = usage?.length ?? 0;
  const totalCredits = (usage ?? []).reduce((sum, u) => sum + u.credits_used, 0);
  const totalResults = (usage ?? []).reduce((sum, u) => sum + u.results_returned, 0);

  return (
    <div className="max-w-3xl space-y-6">
      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-akani-text-primary">{provider.name}</h2>
            <p className="mt-1 text-sm text-akani-text-secondary">
              Business-data source used by Discover Businesses.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              isLive ? "bg-akani-success-bg text-akani-success" : "bg-akani-warning-bg text-akani-warning"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-akani-success" : "bg-akani-warning"}`}
            />
            {isLive ? "Connected" : "Mock data (no credentials configured)"}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Searches run" value={totalSearches} />
        <StatCard label="Credits used" value={totalCredits} />
        <StatCard label="Results returned" value={totalResults} />
      </div>

      <section className="overflow-hidden rounded-xl border border-akani-card-border bg-white shadow-sm">
        <div className="border-b border-akani-card-border px-6 py-4">
          <h2 className="text-sm font-semibold text-akani-text-primary">Recent searches</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-akani-card-border text-left text-xs uppercase tracking-wide text-akani-text-muted">
              <th className="px-6 py-3 font-medium">User</th>
              <th className="px-6 py-3 font-medium">Provider</th>
              <th className="px-6 py-3 font-medium">Results</th>
              <th className="px-6 py-3 font-medium">Credits</th>
              <th className="px-6 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {(recent ?? []).map((r) => {
              const actor = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
              return (
                <tr key={r.id} className="border-b border-akani-card-border last:border-0">
                  <td className="px-6 py-3 text-akani-text-primary">{actor?.name ?? "Unknown"}</td>
                  <td className="px-6 py-3 text-akani-text-secondary">{r.provider}</td>
                  <td className="px-6 py-3 text-akani-text-secondary">{r.results_returned}</td>
                  <td className="px-6 py-3 text-akani-text-secondary">{r.credits_used}</td>
                  <td className="px-6 py-3 text-akani-text-muted">
                    {new Date(r.created_at).toLocaleString("en-ZA")}
                  </td>
                </tr>
              );
            })}
            {(recent ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-akani-text-muted">
                  No searches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
