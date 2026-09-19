import { redirect } from "next/navigation";
import { listMfaFactors } from "./actions";
import { VerifyForm } from "./verify-form";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const factors = await listMfaFactors();

  if (factors.length === 0) {
    // No MFA enrolled for this account — nothing to verify.
    redirect(next ?? "/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Two-factor verification</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>
        <VerifyForm factorId={factors[0].id} next={next ?? "/dashboard"} />
      </div>
    </div>
  );
}
