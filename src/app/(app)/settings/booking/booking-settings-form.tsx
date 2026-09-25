"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Tables } from "@/types/database";
import { SLOT_LENGTHS } from "@/lib/booking/settings";
import { Select } from "@/components/select";

const DAYS = [
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
  { n: 7, label: "Sun" },
];

export function BookingSettingsForm({ settings }: { settings: Tables<"booking_settings"> }) {
  const router = useRouter();
  const [form, setForm] = useState({
    host_name: settings.host_name,
    host_email: settings.host_email ?? "",
    timezone: settings.timezone,
    slot_minutes: settings.slot_minutes,
    working_days: settings.working_days,
    start_hour: settings.start_hour,
    end_hour: settings.end_hour,
    min_notice_hours: settings.min_notice_hours,
    max_days_ahead: settings.max_days_ahead,
    meeting_details: settings.meeting_details,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  function toggleDay(n: number) {
    set("working_days", form.working_days.includes(n) ? form.working_days.filter((d) => d !== n) : [...form.working_days, n].sort());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/booking-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Couldn't save");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const label = "text-sm font-medium text-akani-text-primary";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="rounded-md bg-akani-error-bg px-3 py-2 text-sm text-akani-error">{error}</div>}
      {saved && <div className="rounded-md bg-akani-success-bg px-3 py-2 text-sm text-akani-success">Saved.</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Calls are booked under</span>
          <input className="input mt-1" value={form.host_name} onChange={(e) => set("host_name", e.target.value)} required />
        </label>
        <label className="block">
          <span className={label}>Tell me when a call is booked</span>
          <input
            type="email"
            className="input mt-1"
            placeholder="you@akani.co.za"
            value={form.host_email}
            onChange={(e) => set("host_email", e.target.value)}
          />
        </label>
      </div>

      <div>
        <span className={label}>Days people can book</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <label
              key={d.n}
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium ${
                form.working_days.includes(d.n)
                  ? "border-akani-navy bg-akani-navy text-white"
                  : "border-akani-card-border text-akani-text-secondary hover:bg-akani-page-bg"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={form.working_days.includes(d.n)}
                onChange={() => toggleDay(d.n)}
              />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <label className="block">
          <span className={label}>From (hour)</span>
          <input type="number" min={0} max={23} className="input mt-1" value={form.start_hour} onChange={(e) => set("start_hour", Number(e.target.value))} />
        </label>
        <label className="block">
          <span className={label}>Until (hour)</span>
          <input type="number" min={1} max={24} className="input mt-1" value={form.end_hour} onChange={(e) => set("end_hour", Number(e.target.value))} />
        </label>
        <label className="block">
          <span className={label}>Call length</span>
          <Select
            className="mt-1"
            value={String(form.slot_minutes)}
            onChange={(v) => set("slot_minutes", Number(v))}
            options={SLOT_LENGTHS.map((m) => ({ value: String(m), label: `${m} minutes` }))}
          />
        </label>
        <label className="block">
          <span className={label}>Time zone</span>
          <input className="input mt-1" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Minimum notice (hours)</span>
          <input type="number" min={0} max={240} className="input mt-1" value={form.min_notice_hours} onChange={(e) => set("min_notice_hours", Number(e.target.value))} />
        </label>
        <label className="block">
          <span className={label}>How far ahead (days)</span>
          <input type="number" min={1} max={90} className="input mt-1" value={form.max_days_ahead} onChange={(e) => set("max_days_ahead", Number(e.target.value))} />
        </label>
      </div>

      <label className="block">
        <span className={label}>What to expect on the call</span>
        <textarea rows={3} className="input mt-1" value={form.meeting_details} onChange={(e) => set("meeting_details", e.target.value)} />
        <span className="mt-1 block text-xs text-akani-text-muted">Shown on the booking page and in the confirmation email.</span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-akani-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-akani-deep-blue disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
