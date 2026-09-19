"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings/security", label: "Security" },
  { href: "/settings/data-provider", label: "Data Provider" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b border-slate-200">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            pathname === tab.href
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
