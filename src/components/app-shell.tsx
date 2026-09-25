"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AkaniLogo } from "@/components/akani-logo";
import { SignOutButton } from "@/components/sign-out-dialog";
import { TopHeader } from "@/components/top-header";
import { UpdateManager } from "@/components/whats-new/update-manager";
import { UpdateSkeleton } from "@/components/whats-new/update-skeleton";
import type { Release } from "@/lib/whats-new/tour";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon, tour: "nav-dashboard" },
  { href: "/prospects/discover", label: "Discover Businesses", icon: SearchIcon, tour: "nav-discover" },
  { href: "/prospects", label: "Prospects", icon: ListIcon, tour: "nav-prospects" },
  { href: "/leads", label: "Leads", icon: LeadsIcon, tour: "nav-leads" },
  { href: "/pipeline", label: "Pipeline", icon: PipelineIcon, tour: "nav-pipeline" },
  { href: "/campaigns", label: "Campaigns", icon: CampaignIcon, tour: "nav-campaigns" },
  { href: "/analytics", label: "Analytics", icon: AnalyticsIcon, tour: "nav-analytics" },
];

export function AppShell({
  children,
  userName,
  role,
  release,
}: {
  children: React.ReactNode;
  userName: string;
  role: string;
  release?: Release;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  // A drawer left open across a client-side route change would trap the
  // user behind an overlay on the new page. Reset it during render (the
  // React-sanctioned way to adjust state when a prop changes) rather than
  // in an effect, which would cause an extra visible render.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setNavOpen(false);
  }

  // The product tour opens/closes the mobile drawer so sidebar steps can be
  // shown on small screens; on desktop the sidebar is always visible.
  useEffect(() => {
    const open = () => {
      if (window.innerWidth < 1024) setNavOpen(true);
    };
    const close = () => setNavOpen(false);
    window.addEventListener("akani:open-nav", open);
    window.addEventListener("akani:close-nav", close);
    return () => {
      window.removeEventListener("akani:open-nav", open);
      window.removeEventListener("akani:close-nav", close);
    };
  }, []);

  const activeItem = NAV_ITEMS.find((item) => {
    const section = item.href;
    return pathname === section || pathname.startsWith(section + "/");
  });
  const pageTitle = activeItem?.label ?? (pathname.startsWith("/settings") ? "Settings" : "Akani");

  return (
    <div className="flex min-h-screen bg-akani-page-bg">
      <UpdateSkeleton />
      <UpdateManager role={role} release={release} />
      {navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col bg-akani-navy transition-transform duration-200 lg:static lg:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center px-5">
          <AkaniLogo variant="dark" size="sm" compact />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={item.tour}
                className={`relative flex items-center gap-3 rounded-md py-2 pl-4 pr-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white/90"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-akani-gold" />
                )}
                <Icon active={active} />
                {item.label}
              </Link>
            );
          })}

          <div className="my-3 border-t border-white/10" />

          <Link
            href="/settings/security"
            data-tour="nav-settings"
            className={`relative flex items-center gap-3 rounded-md py-2 pl-4 pr-3 text-sm font-medium transition-colors ${
              pathname.startsWith("/settings")
                ? "bg-white/10 text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white/90"
            }`}
          >
            {pathname.startsWith("/settings") && (
              <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-akani-gold" />
            )}
            <SettingsIcon active={pathname.startsWith("/settings")} />
            Settings
          </Link>
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-2.5 px-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-akani-gold text-xs font-bold text-akani-navy">
              {userName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{userName}</p>
              <p className="truncate text-xs capitalize text-white/50">{role}</p>
            </div>
          </div>
          <button
            type="button"
            data-tour="whats-new"
            onClick={() => window.dispatchEvent(new Event("akani:start-tour"))}
            className="mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white"
          >
            <span className="text-akani-gold" aria-hidden="true">
              ✦
            </span>
            What&apos;s new
          </button>
          <SignOutButton userName={userName} role={role} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader title={pageTitle} userName={userName} onMenuClick={() => setNavOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function iconProps(active: boolean) {
  return {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    "aria-hidden": true,
    stroke: active ? "#ecb100" : "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}
function SearchIcon({ active }: { active: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function ListIcon({ active }: { active: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r="1" fill={active ? "#ecb100" : "currentColor"} stroke="none" />
      <circle cx="3.5" cy="12" r="1" fill={active ? "#ecb100" : "currentColor"} stroke="none" />
      <circle cx="3.5" cy="18" r="1" fill={active ? "#ecb100" : "currentColor"} stroke="none" />
    </svg>
  );
}
function PipelineIcon({ active }: { active: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}
function CampaignIcon({ active }: { active: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}
function AnalyticsIcon({ active }: { active: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <path d="M4 19V9M12 19V5M20 19v-6" />
    </svg>
  );
}
function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
    </svg>
  );
}

function LeadsIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={active ? "text-akani-gold" : ""}>
      <path
        d="M4 6h16v10H8l-4 4V6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M8.5 10h7M8.5 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
