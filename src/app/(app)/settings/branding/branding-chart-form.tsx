"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ChartStyle = "bar" | "line";
type LayoutStyle = "grid" | "grouped";

export function BrandingChartForm({
  initialChartStyle,
  initialLayoutStyle,
}: {
  initialChartStyle: ChartStyle | null;
  initialLayoutStyle: LayoutStyle | null;
}) {
  const router = useRouter();
  const [chartStyle, setChartStyle] = useState<ChartStyle>(initialChartStyle ?? "bar");
  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>(initialLayoutStyle ?? "grouped");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/settings/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chartStyle, layoutStyle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save those preferences.");
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Couldn't save those preferences. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ChoiceField
          label="Charts"
          value={chartStyle}
          onChange={setChartStyle}
          options={[
            { value: "bar", label: "Bar" },
            { value: "line", label: "Line" },
          ]}
        />
        <ChoiceField
          label="Analytics layout"
          value={layoutStyle}
          onChange={setLayoutStyle}
          options={[
            { value: "grouped", label: "Grouped sections" },
            { value: "grid", label: "Single grid" },
          ]}
        />
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && (
        <div className="rounded-md bg-akani-success-bg px-4 py-3 text-sm text-akani-success">
          Saved — refresh any other open tab to see it there too.
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-akani-gold px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright disabled:opacity-60"
      >
        {submitting ? "Saving…" : "Save preferences"}
      </button>
    </form>
  );
}

function ChoiceField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div>
      <span className="text-sm font-medium text-akani-text-primary">{label}</span>
      <div className="mt-1 flex gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              value === opt.value
                ? "bg-akani-navy text-white"
                : "border border-akani-card-border text-akani-text-primary hover:bg-akani-page-bg"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
