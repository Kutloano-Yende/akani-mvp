"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings/security", label: "Security" },
  { href: "/settings/data-provider", label: "Data Provider" },
];

const MANAGER_TABS = [{ href: "/settings/booking", label: "Booking" }];

const ADMIN_TABS = [
  { href: "/settings/users", label: "Users" },
  { href: "/settings/suppression", label: "Suppression List" },
  { href: "/settings/audit-logs", label: "Audit Logs" },
  { href: "/settings/popia", label: "POPIA" },
];

export function SettingsNav({ isAdmin, canManage }: { isAdmin: boolean; canManage: boolean }) {
  const pathname = usePathname();
  const tabs = [...TABS, ...(canManage ? MANAGER_TABS : []), ...(isAdmin ? ADMIN_TABS : [])];

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
