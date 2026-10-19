"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Select } from "@/components/select";
import { SA_PROVINCES } from "@/lib/tenders/province-guess";
import { PROCUREMENT_CATEGORIES, TENDER_STATUSES } from "@/lib/tenders/constants";

export function TenderFilters({
  initial,
}: {
  initial: { q: string; province: string; category: string; status: string; closingBefore: string; closingAfter: string };
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial.q);
  const [province, setProvince] = useState(initial.province);
  const [category, setCategory] = useState(initial.category);
  const [status, setStatus] = useState(initial.status);
  const [closingBefore, setClosingBefore] = useState(initial.closingBefore);
  const [closingAfter, setClosingAfter] = useState(initial.closingAfter);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (province) qs.set("province", province);
    if (category) qs.set("category", category);
    if (status) qs.set("status", status);
    if (closingBefore) qs.set("closingBefore", closingBefore);
    if (closingAfter) qs.set("closingAfter", closingAfter);
    router.push(qs.toString() ? `/tenders?${qs}` : "/tenders");
  }

  function clear() {
    setQ("");
    setProvince("");
    setCategory("");
    setStatus("");
    setClosingBefore("");
    setClosingAfter("");
    router.push("/tenders");
  }

  return (
    <form onSubmit={apply} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Keyword, e.g. construction"
        className="input lg:col-span-2"
        aria-label="Keyword"
      />
      <Select
        aria-label="Province"
        value={province}
        onChange={setProvince}
        options={[{ value: "", label: "Any province" }, ...SA_PROVINCES.map((p) => ({ value: p, label: p }))]}
      />
      <Select
        aria-label="Category"
        value={category}
        onChange={setCategory}
        options={[{ value: "", label: "Any category" }, ...PROCUREMENT_CATEGORIES.map((c) => ({ value: c, label: c }))]}
      />
      <Select
        aria-label="Status"
        value={status}
        onChange={setStatus}
        options={[{ value: "", label: "Any status" }, ...TENDER_STATUSES.map((s) => ({ value: s, label: s }))]}
      />
      <div className="flex gap-2">
        <input
          type="date"
          value={closingAfter}
          onChange={(e) => setClosingAfter(e.target.value)}
          className="input"
          aria-label="Closing after"
          title="Closing after"
        />
        <input
          type="date"
          value={closingBefore}
          onChange={(e) => setClosingBefore(e.target.value)}
          className="input"
          aria-label="Closing before"
          title="Closing before"
        />
      </div>
      <div className="flex gap-2 lg:col-span-6">
        <button
          type="submit"
          className="rounded-md bg-akani-gold px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright"
        >
          Apply filters
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-md border border-akani-card-border px-4 py-2 text-sm font-medium text-akani-text-primary hover:bg-akani-page-bg"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
