import { BrandLogo } from "@/components/brand-logo";
import { signOut } from "@/app/(app)/actions";

export const metadata = { title: "Account suspended" };

export default function AccountSuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-akani-page-bg px-4">
      <div className="w-full max-w-md rounded-xl border border-akani-card-border bg-white p-8 text-center shadow-sm">
        <div className="mb-6 flex justify-center">
          <BrandLogo />
        </div>
        <h1 className="text-lg font-semibold text-akani-text-primary">Access suspended</h1>
        <p className="mt-2 text-sm text-akani-text-secondary">
          Your organization&apos;s access to Akani has been suspended. If you believe this is a mistake, contact your
          administrator or Akani support.
        </p>
        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="rounded-md border-2 border-akani-navy px-5 py-2.5 text-sm font-semibold text-akani-navy hover:bg-akani-page-bg"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
