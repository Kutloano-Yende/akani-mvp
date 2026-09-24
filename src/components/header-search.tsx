"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import type { Enums } from "@/types/database";

type Result = { id: string; name: string; industry: string | null; status: Enums<"prospect_status"> };

export function HeaderSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Search failed");
          setResults([]);
        } else {
          setError(null);
          setResults(data.results);
        }
        setSearched(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Search failed");
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSearched(false);
  }

  const active = query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative hidden sm:block"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-akani-text-muted"
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        placeholder="Search prospects, companies…"
        aria-label="Search"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          if (e.key === "Enter" && results[0]) {
            router.push(`/prospects/${results[0].id}`);
            close();
          }
        }}
        className="h-9 w-56 rounded-md border border-akani-card-border bg-akani-page-bg pl-9 pr-3 text-sm text-akani-text-primary placeholder:text-akani-text-muted focus:border-akani-gold focus:outline-none focus:ring-1 focus:ring-akani-gold lg:w-72"
      />

      {open && active && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-akani-card-border bg-white shadow-lg">
          {error ? (
            <p className="px-4 py-3 text-sm text-akani-error">{error}</p>
          ) : !searched ? (
            <p className="px-4 py-3 text-sm text-akani-text-muted">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-akani-text-muted">No prospects match “{query.trim()}”.</p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/prospects/${r.id}`}
                    onClick={close}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-akani-page-bg"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-akani-text-primary">{r.name}</span>
                      {r.industry && (
                        <span className="block truncate text-xs text-akani-text-muted">{r.industry}</span>
                      )}
                    </span>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
