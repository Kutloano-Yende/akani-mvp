"use client";

import { useState } from "react";
import Link from "next/link";
import { Select } from "@/components/select";

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

const EMPTY_FORM = {
  companyName: "",
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  jobTitle: "",
  industry: "",
  province: "",
  city: "",
  website: "",
};

export function AddProspectForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ alreadyExisted: boolean } | null>(null);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/prospects/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't add that prospect.");
        return;
      }
      setSuccess({ alreadyExisted: data.alreadyExisted });
      setForm(EMPTY_FORM);
    } catch {
      setError("Couldn't add that prospect. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 rounded-xl border border-akani-card-border bg-white p-6 shadow-sm sm:grid-cols-2"
    >
      <Field label="Company name" required>
        <input
          type="text"
          required
          value={form.companyName}
          onChange={(e) => set("companyName", e.target.value)}
          className="input"
          placeholder="Acme Construction"
        />
      </Field>

      <Field label="Contact email" required>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          className="input"
          placeholder="jane@acme.co.za"
        />
      </Field>

      <Field label="First name">
        <input type="text" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className="input" />
      </Field>

      <Field label="Last name">
        <input type="text" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className="input" />
      </Field>

      <Field label="Phone">
        <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="input" />
      </Field>

      <Field label="Job title">
        <input type="text" value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} className="input" />
      </Field>

      <Field label="Industry">
        <Select
          aria-label="Industry"
          value={form.industry}
          onChange={(v) => set("industry", v)}
          options={[{ value: "", label: "Any" }, ...INDUSTRIES.map((i) => ({ value: i, label: i }))]}
        />
      </Field>

      <Field label="Province">
        <Select
          aria-label="Province"
          value={form.province}
          onChange={(v) => set("province", v)}
          options={[{ value: "", label: "Any" }, ...PROVINCES.map((p) => ({ value: p, label: p }))]}
        />
      </Field>

      <Field label="City">
        <input type="text" value={form.city} onChange={(e) => set("city", e.target.value)} className="input" />
      </Field>

      <Field label="Website">
        <input
          type="text"
          value={form.website}
          onChange={(e) => set("website", e.target.value)}
          className="input"
          placeholder="acme.co.za"
        />
      </Field>

      <div className="sm:col-span-2">
        {error && <div className="mb-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && (
          <div className="mb-3 rounded-md bg-akani-success-bg px-4 py-3 text-sm text-akani-success">
            {success.alreadyExisted
              ? "That company already has a prospect — no duplicate created."
              : "Prospect added."}{" "}
            <Link href="/prospects?status=qualified" className="font-medium underline">
              View qualified prospects
            </Link>
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-akani-gold px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright disabled:opacity-60"
        >
          {submitting ? "Adding…" : "Add prospect"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-akani-text-primary">
        {label}
        {required && <span className="text-akani-error"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
