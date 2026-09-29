"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type Summary = {
  total: number;
  created: number;
  duplicates: number;
  errors: { row: number; reason: string }[];
};

export function ImportCsvForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    setSummary(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/prospects/import-csv", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't process that file.");
        return;
      }
      setSummary(data);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setError("Couldn't process that file. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
      <p className="text-sm text-akani-text-secondary">
        Upload a CSV of companies and contacts. Columns recognized: Company (required), Email (required), First Name,
        Last Name, Phone, Job Title, Industry, Province, City, Website — up to 150 rows per upload.{" "}
        <a href="/templates/prospect-import-template.csv" download className="font-medium text-akani-gold hover:underline">
          Download a template
        </a>{" "}
        — it has an instructions row and a filled-in example row. Delete both before adding your own data (an
        instructions row left in by mistake is harmless: it&apos;ll just show up as one skipped row below).
      </p>

      <form onSubmit={handleUpload} className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block text-sm text-akani-text-primary file:mr-3 file:rounded-md file:border file:border-akani-card-border file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-akani-text-primary hover:file:bg-akani-page-bg"
        />
        <button
          type="submit"
          disabled={!file || uploading}
          className="rounded-md bg-akani-gold px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>

      {error && <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {summary && (
        <div className="mt-4 space-y-3">
          <div className="rounded-md bg-akani-success-bg px-4 py-3 text-sm text-akani-success">
            {summary.created} added, {summary.duplicates} already had a prospect, {summary.errors.length} skipped — out
            of {summary.total} rows.{" "}
            <Link href="/prospects?status=qualified" className="font-medium underline">
              View qualified prospects
            </Link>
          </div>
          {summary.errors.length > 0 && (
            <div className="rounded-md bg-akani-warning-bg px-4 py-3 text-sm text-akani-warning">
              <p className="font-medium">Skipped rows</p>
              <ul className="mt-1 list-inside list-disc">
                {summary.errors.map((e) => (
                  <li key={e.row}>
                    Row {e.row}: {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
