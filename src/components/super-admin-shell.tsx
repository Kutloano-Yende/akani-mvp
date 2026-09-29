"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/tenants", label: "Tenants" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
];

// Deliberately visually distinct from AppShell ("completely different
// navigation area" — a platform admin should never mistake this for a
// tenant's own view). Dark slate rather than Akani navy, a persistent
// "SUPER ADMIN" label, and a clear way back to the tenant app.
export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="flex w-60 shrink-0 flex-col bg-slate-900">
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="text-akani-gold" aria-hidden="true">
            ✦
          </span>
          <span className="text-sm font-semibold uppercase tracking-wide text-white">Super Admin</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white/90"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white"
          >
            ← Back to Akani
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">{children}</div>
      </main>
    </div>
  );
}
