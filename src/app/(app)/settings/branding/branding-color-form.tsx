"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_PRIMARY = "#07124c";
const DEFAULT_ACCENT = "#d6a000";
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

export function BrandingColorForm({
  initialPrimaryColor,
  initialAccentColor,
}: {
  initialPrimaryColor: string | null;
  initialAccentColor: string | null;
}) {
  const router = useRouter();
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor ?? DEFAULT_PRIMARY);
  const [accentColor, setAccentColor] = useState(initialAccentColor ?? DEFAULT_ACCENT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const primaryValid = HEX_PATTERN.test(primaryColor);
  const accentValid = HEX_PATTERN.test(accentColor);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!primaryValid || !accentValid) {
      setError("Colors must be a hex value like #07124c.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/settings/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryColor, accentColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save those colors.");
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Couldn't save those colors. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetToDefaults() {
    setPrimaryColor(DEFAULT_PRIMARY);
    setAccentColor(DEFAULT_ACCENT);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ColorField label="Primary (sidebar, headers)" value={primaryColor} onChange={setPrimaryColor} />
        <ColorField label="Accent (buttons, highlights)" value={accentColor} onChange={setAccentColor} />
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && (
        <div className="rounded-md bg-akani-success-bg px-4 py-3 text-sm text-akani-success">
          Saved — refresh any other open tab to see it there too.
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !primaryValid || !accentValid}
          className="rounded-md bg-akani-gold px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save colors"}
        </button>
        <button
          type="button"
          onClick={resetToDefaults}
          disabled={submitting}
          className="rounded-md border border-akani-card-border px-4 py-2 text-sm font-medium text-akani-text-primary hover:bg-akani-page-bg disabled:opacity-60"
        >
          Reset to Akani defaults
        </button>
      </div>
    </form>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const valid = HEX_PATTERN.test(value);
  return (
    <label className="block">
      <span className="text-sm font-medium text-akani-text-primary">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-akani-card-border p-1"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`input ${!valid ? "border-akani-error" : ""}`}
          placeholder="#07124c"
        />
      </div>
    </label>
  );
}
