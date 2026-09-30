"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/data-provider", label: "Data Provider" },
];

const MANAGER_TABS = [{ href: "/settings/booking", label: "Booking" }];

const ADMIN_TABS = [
  { href: "/settings/users", label: "Users" },
  { href: "/settings/suppression", label: "Suppression List" },
  { href: "/settings/popia", label: "POPIA" },
  { href: "/settings/audit-logs", label: "Audit Logs" },
];

const BRANDING_TAB = [{ href: "/settings/branding", label: "Branding" }];

export function SettingsNav({
  isAdmin,
  canManage,
  canBrand,
}: {
  isAdmin: boolean;
  canManage: boolean;
  canBrand: boolean;
}) {
  const pathname = usePathname();
  const tabs = [
    ...TABS,
    ...(canManage ? MANAGER_TABS : []),
    ...(isAdmin ? ADMIN_TABS : []),
    ...(isAdmin && canBrand ? BRANDING_TAB : []),
  ];

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
