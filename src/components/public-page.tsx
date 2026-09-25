import Link from "next/link";
import { AkaniLogo } from "@/components/akani-logo";

export function PublicPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-akani-page-bg px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/login" className="inline-block">
          <AkaniLogo variant="light" size="sm" />
        </Link>
        <article className="mt-8 rounded-xl border border-akani-card-border bg-white p-5 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold text-akani-text-primary">{title}</h1>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-akani-text-secondary">{children}</div>
        </article>
        <p className="mt-6 text-center text-xs text-akani-text-muted">
          <Link href="/login" className="hover:text-akani-navy">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export function supportEmail() {
  return process.env.SUPPORT_EMAIL?.trim() || null;
}
