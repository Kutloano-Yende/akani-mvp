"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/user-avatar";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function AvatarUpload({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
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
      setError("Please choose a JPEG, PNG or WebP image.");
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
      const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
      const data = await res.json();
      URL.revokeObjectURL(objectUrl);
      if (!res.ok) {
        setError(data.error ?? "Failed to upload image");
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
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to remove image");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error && <div className="rounded-md bg-akani-error-bg px-3 py-2 text-sm text-akani-error">{error}</div>}
      <div className="flex items-center gap-4">
        <UserAvatar name={name} avatarUrl={preview ?? avatarUrl} size="h-16 w-16 text-xl" tone="navy" />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={pick}
            disabled={isPending}
            className="rounded-md bg-akani-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-akani-deep-blue disabled:opacity-50"
          >
            {isPending ? "Uploading…" : avatarUrl ? "Change picture" : "Upload picture"}
          </button>
          {avatarUrl && (
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
      <p className="text-xs text-akani-text-muted">JPEG, PNG or WebP, up to 3MB.</p>
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
