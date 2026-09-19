"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(app)/actions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "◱" },
  { href: "/prospects/discover", label: "Discover Businesses", icon: "🔍" },
  { href: "/prospects", label: "Prospects", icon: "☰" },
  { href: "/pipeline", label: "Pipeline", icon: "▤" },
  { href: "/campaigns", label: "Campaigns", icon: "✉" },
  { href: "/analytics", label: "Analytics", icon: "📊" },
  { href: "/settings/security", label: "Settings", icon: "⚙" },
];

export function AppShell({
  children,
  userName,
  role,
}: {
  children: React.ReactNode;
  userName: string;
  role: string;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
            A
          </div>
          <span className="text-base font-semibold text-slate-900">Akani</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const section = item.href.startsWith("/settings/") ? "/settings" : item.href;
            const active = pathname === item.href || pathname.startsWith(section + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium text-slate-900">{userName}</p>
            <p className="text-xs capitalize text-slate-500">{role}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
