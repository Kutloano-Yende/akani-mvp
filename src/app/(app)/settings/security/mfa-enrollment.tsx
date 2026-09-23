"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { enrollFactor, verifyFactor, unenrollFactor } from "./actions";

type EnrollState = { factorId: string; qrCode: string; secret: string } | null;

export function MfaEnrollment({ verifiedFactor }: { verifiedFactor: { id: string } | null }) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<EnrollState>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (verifiedFactor) {
    return (
      <div className="flex items-center justify-between rounded-md bg-akani-success-bg px-4 py-3">
        <p className="text-sm font-medium text-akani-success">2FA is enabled on your account.</p>
        <button
          disabled={pending}
          onClick={async () => {
            setPending(true);
            const res = await unenrollFactor(verifiedFactor.id);
            setPending(false);
            if (res && "error" in res && res.error) setError(res.error);
            else router.refresh();
          }}
          className="text-sm font-medium text-akani-error hover:opacity-80 disabled:opacity-60"
        >
          Disable
        </button>
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div>
        {error && <p className="mb-3 text-sm text-akani-error">{error}</p>}
        <button
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError(null);
            const res = await enrollFactor();
            setPending(false);
            if ("error" in res) setError(res.error ?? "Failed to start enrollment.");
            else setEnrollment(res);
          }}
          className="rounded-md bg-akani-gold px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright disabled:opacity-60"
        >
          {pending ? "Starting…" : "Enable 2FA"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-akani-text-secondary">
        Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- data: URI from Supabase, not an optimizable asset */}
      <img
        src={enrollment.qrCode}
        alt="Scan with your authenticator app"
        className="h-48 w-48 rounded-md border border-akani-card-border p-2"
      />
      <p className="text-xs text-akani-text-muted">
        Can&apos;t scan? Enter this key manually: <code className="rounded bg-slate-100 px-1.5 py-0.5">{enrollment.secret}</code>
      </p>

      {error && <p className="text-sm text-akani-error">{error}</p>}

      <div className="flex items-end gap-2">
        <label className="block">
          <span className="text-sm font-medium text-akani-text-primary">Verification code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            inputMode="numeric"
            className="input mt-1 w-40 text-center tracking-[0.3em]"
            placeholder="000000"
          />
        </label>
        <button
          disabled={pending || code.length < 6}
          onClick={async () => {
            setPending(true);
            setError(null);
            const res = await verifyFactor(enrollment.factorId, code);
            setPending(false);
            if (res && "error" in res && res.error) setError(res.error);
            else {
              setEnrollment(null);
              router.refresh();
            }
          }}
          className="rounded-md bg-akani-gold px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-akani-gold-bright disabled:opacity-60"
        >
          {pending ? "Verifying…" : "Confirm"}
        </button>
      </div>
    </div>
  );
}
