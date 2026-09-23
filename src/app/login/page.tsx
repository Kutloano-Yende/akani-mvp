import Link from "next/link";
import { LoginForm } from "./login-form";
import { ThemeScope, ThemeToggleButton } from "./theme-scope";
import { LanguageSelect } from "./language-select";
import { AkaniLogo } from "@/components/akani-logo";
import { SecurityCard } from "@/components/security-card";
import { SalesNetworkVisual } from "@/components/sales-network-visual";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0f1a] p-4 sm:p-8">
      <div className="w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl lg:grid lg:grid-cols-2">
        {/* LEFT: login panel */}
        <ThemeScope>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
            <AkaniLogo size="sm" />
            <div className="flex items-center gap-3 text-sm">
              <LanguageSelect />
              <span className="login-divider-line h-4 w-px bg-akani-border" aria-hidden="true" />
              <ThemeToggleButton />
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm flex-1">
            <h1 className="login-heading text-2xl font-bold text-akani-navy">Welcome back</h1>
            <p className="login-subtext mt-1 text-sm text-akani-muted">
              Sign in to your Akani Sales Intelligent System
            </p>

            <div className="mt-4">
              <LoginForm next={next ?? "/dashboard"} />
            </div>

            <div className="mt-4">
              <SecurityCard />
            </div>
          </div>

          <footer className="login-footer flex flex-col items-center gap-2 border-t border-akani-border pt-3 text-xs text-akani-muted sm:flex-row sm:justify-between">
            <span>&copy; 2025 Akani. All rights reserved.</span>
            <nav className="flex items-center gap-3">
              <Link href="/privacy" className="hover:text-akani-navy">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-akani-navy">
                Terms of Use
              </Link>
              <Link href="/contact-support" className="hover:text-akani-navy">
                Contact Support
              </Link>
            </nav>
          </footer>
        </ThemeScope>

        {/* RIGHT: hero panel */}
        <div className="relative hidden overflow-hidden bg-akani-navy-dark lg:flex lg:flex-col">
          <div className="relative z-10 flex flex-1 flex-col items-center px-10 pt-14 text-center">
            <AkaniLogo variant="dark" size="lg" />
            <h2 className="mt-8 text-xl font-semibold text-white">
              Smarter sales. Stronger relationships.
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[#B9C0D4]">
              Akani&rsquo;s Sales Intelligent System helps you find opportunities, engage
              clients and close deals — faster and smarter.
            </p>
          </div>
          <div className="absolute inset-0 z-0">
            <SalesNetworkVisual />
          </div>
        </div>
      </div>
    </div>
  );
}
