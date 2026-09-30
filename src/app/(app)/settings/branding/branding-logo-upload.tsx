"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

export function BrandingLogoUpload({ logoUrl }: { logoUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function pick() {
    inputRef.current?.click();
  }

  function handleFile(file: File) {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please choose a JPEG, PNG, WebP or SVG image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be 3MB or smaller.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    startTransition(async () => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/settings/branding/logo", { method: "POST", body: form });
      const data = await res.json();
      URL.revokeObjectURL(objectUrl);
      if (!res.ok) {
        setError(data.error ?? "Failed to upload logo");
        setPreview(null);
        return;
      }
      setPreview(null);
      router.refresh();
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/settings/branding/logo", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to remove logo");
        return;
      }
      router.refresh();
    });
  }

  const shown = preview ?? logoUrl;

  return (
    <div className="space-y-3">
      {error && <div className="rounded-md bg-akani-error-bg px-3 py-2 text-sm text-akani-error">{error}</div>}
      <div className="flex items-center gap-4">
        {/* Matches exactly how the expanded sidebar renders it
            (app-shell.tsx): the same size, cropped with object-cover, on
            the sidebar's own dark background -- so what's previewed here
            is what's actually shown, not an uncropped guess. */}
        <div className="flex h-10 w-32 items-center justify-center overflow-hidden rounded-md bg-akani-navy">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase Storage URL, no fixed dimensions
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-white/50">No logo</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={pick}
            disabled={isPending}
            className="rounded-md bg-akani-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-akani-deep-blue disabled:opacity-50"
          >
            {isPending ? "Uploading…" : logoUrl ? "Change logo" : "Upload logo"}
          </button>
          {logoUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isPending}
              className="rounded-md border border-akani-card-border px-4 py-2 text-sm font-medium text-akani-text-secondary hover:bg-akani-page-bg disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-akani-text-muted">
        JPEG, PNG, WebP or SVG, up to 3MB. Cropped to a wide banner in the sidebar (like the default Akani logo), so a
        wide, horizontal logo on a flat background works best — a tall or square logo will have its sides cropped in.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
        className="hidden"
      />
    </div>
  );
}
