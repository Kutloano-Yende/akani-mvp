import { HeaderSearch } from "@/components/header-search";
import { NotificationsMenu } from "@/components/notifications-menu";

export function TopHeader({
  title,
  userName,
  onMenuClick,
}: {
  title: string;
  userName: string;
  onMenuClick?: () => void;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-akani-card-border bg-white px-4 sm:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-md text-akani-text-secondary hover:bg-akani-page-bg lg:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-akani-text-primary">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <HeaderSearch />
        <NotificationsMenu />

        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-akani-navy text-xs font-bold text-white">
          {userName.slice(0, 1).toUpperCase()}
        </span>
      </div>
    </header>
  );
}
