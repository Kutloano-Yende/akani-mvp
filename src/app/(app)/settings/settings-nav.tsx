"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings/security", label: "Security" },
  { href: "/settings/data-provider", label: "Data Provider" },
];

const ADMIN_TABS = [
  { href: "/settings/users", label: "Users" },
  { href: "/settings/suppression", label: "Suppression List" },
  { href: "/settings/audit-logs", label: "Audit Logs" },
];

export function SettingsNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const tabs = isAdmin ? [...TABS, ...ADMIN_TABS] : TABS;

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-akani-card-border">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
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
