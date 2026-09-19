"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProviderCompany } from "@/lib/data/provider";
import { OpportunityBadge } from "@/components/status-badge";

type SearchResult = ProviderCompany & {
  opportunityScore: number;
  opportunityLevel: "low" | "medium" | "high";
  signals: { signalType: string; description: string; weight: number }[];
  alreadyImported: boolean;
  possibleDuplicateOf: string | null;
};

const INDUSTRIES = [
  "Construction",
  "Manufacturing",
  "Engineering",
  "Facilities Management",
  "Transport & Logistics",
  "Retail",
  "Agriculture",
];

const PROVINCES = [
  "Gauteng",
  "Western Cape",
  "KwaZulu-Natal",
  "Eastern Cape",
  "Free State",
  "Mpumalanga",
  "North West",
  "Limpopo",
  "Northern Cape",
];

export function DiscoverForm() {
  const [filters, setFilters] = useState({
    industry: "",
    province: "",
    employeesMin: "",
    employeesMax: "",
    city: "",
    keywords: "",
  });
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<Set<string>>(new Set());

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/data-provider/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed. Try again.");
        setResults(null);
        return;
      }
      setResults(data.results ?? []);
    } catch {
      setError("Search failed. Check your connection and try again.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(result: SearchResult) {
    setImporting(result.externalId);
    try {
      const res = await fetch("/api/prospects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: result,
          opportunityScore: result.opportunityScore,
          opportunityLevel: result.opportunityLevel,
          signals: result.signals,
        }),
      });
      if (res.ok) {
        setImported((prev) => new Set(prev).add(result.externalId));
      }
    } finally {
      setImporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSearch}
        className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-3"
      >
        <Field label="Industry">
          <select
            value={filters.industry}
            onChange={(e) => setFilters({ ...filters, industry: e.target.value })}
            className="input"
          >
            <option value="">Any</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Province">
          <select
            value={filters.province}
            onChange={(e) => setFilters({ ...filters, province: e.target.value })}
            className="input"
          >
            <option value="">Any</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Location (city)">
          <input
            type="text"
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
            className="input"
            placeholder="e.g. Johannesburg"
          />
        </Field>

        <Field label="Employees (min)">
          <input
            type="number"
            min={0}
            value={filters.employeesMin}
            onChange={(e) => setFilters({ ...filters, employeesMin: e.target.value })}
            className="input"
            placeholder="0"
          />
        </Field>

        <Field label="Employees (max)">
          <input
            type="number"
            min={0}
            value={filters.employeesMax}
            onChange={(e) => setFilters({ ...filters, employeesMax: e.target.value })}
            className="input"
            placeholder="500"
          />
        </Field>

        <Field label="Keywords">
          <input
            type="text"
            value={filters.keywords}
            onChange={(e) => setFilters({ ...filters, keywords: e.target.value })}
            className="input"
            placeholder="e.g. steel, logistics"
          />
        </Field>

        <div className="sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Searching…" : "Find businesses"}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {results !== null && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {results.length} result{results.length === 1 ? "" : "s"}
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-6 py-3 font-medium">Company</th>
                <th className="px-6 py-3 font-medium">Industry</th>
                <th className="px-6 py-3 font-medium">Province</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Opportunity</th>
                <th className="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const isImported = r.alreadyImported || imported.has(r.externalId);
                return (
                  <tr key={r.externalId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-900">
                      {r.name}
                      {r.possibleDuplicateOf && !isImported && (
                        <p className="mt-0.5 text-xs font-normal text-amber-700">
                          Possible duplicate of &ldquo;{r.possibleDuplicateOf}&rdquo;
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-600">{r.industry}</td>
                    <td className="px-6 py-3 text-slate-600">{r.province}</td>
                    <td className="px-6 py-3 text-slate-600">{r.phone ?? "—"}</td>
                    <td className="px-6 py-3 text-slate-600">{r.email ?? "—"}</td>
                    <td className="px-6 py-3">
                      <OpportunityBadge level={r.opportunityLevel} />
                    </td>
                    <td className="px-6 py-3 text-right">
                      {isImported ? (
                        <span className="text-xs font-medium text-emerald-700">In pipeline</span>
                      ) : (
                        <button
                          onClick={() => handleImport(r)}
                          disabled={importing === r.externalId}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        >
                          {importing === r.externalId
                            ? "Adding…"
                            : r.possibleDuplicateOf
                              ? "Add anyway"
                              : "Add to pipeline"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {results.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No businesses matched those filters. Try widening your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {imported.size > 0 && (
        <p className="text-sm text-slate-500">
          Imported prospects are now on your{" "}
          <Link href="/prospects" className="font-medium text-emerald-700 hover:underline">
            Prospects
          </Link>{" "}
          list.
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
