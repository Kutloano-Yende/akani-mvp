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
    <div className="flex gap-1 border-b border-akani-card-border">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            pathname === tab.href
              ? "border-akani-gold text-akani-gold"
              : "border-transparent text-akani-text-secondary hover:text-akani-text-primary"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
