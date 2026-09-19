import { createClient } from "@/lib/supabase/server";
import { getProvider } from "@/lib/data/provider";

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
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{provider.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Business-data source used by Discover Businesses.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              isLive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-600" : "bg-amber-600"}`}
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

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Recent searches</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
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
                <tr key={r.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-6 py-3 text-slate-700">{actor?.name ?? "Unknown"}</td>
                  <td className="px-6 py-3 text-slate-600">{r.provider}</td>
                  <td className="px-6 py-3 text-slate-600">{r.results_returned}</td>
                  <td className="px-6 py-3 text-slate-600">{r.credits_used}</td>
                  <td className="px-6 py-3 text-slate-500">
                    {new Date(r.created_at).toLocaleString("en-ZA")}
                  </td>
                </tr>
              );
            })}
            {(recent ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value.toLocaleString()}</p>
    </div>
  );
}
