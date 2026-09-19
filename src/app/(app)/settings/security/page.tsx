import { listFactors } from "./actions";
import { MfaEnrollment } from "./mfa-enrollment";

export default async function SecuritySettingsPage() {
  const factors = await listFactors();
  const verifiedFactor = factors.find((f) => f.status === "verified");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Security</h1>
        <p className="mt-1 text-sm text-slate-500">Manage two-factor authentication for your account.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Two-factor authentication</h2>
        <p className="mb-4 text-sm text-slate-500">
          Require a 6-digit code from an authenticator app when signing in.
        </p>
        <MfaEnrollment verifiedFactor={verifiedFactor ? { id: verifiedFactor.id } : null} />
      </section>
    </div>
  );
}
