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
        <div className="relative hidden sm:block">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-akani-text-muted"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            placeholder="Search prospects, companies…"
            aria-label="Search"
            className="h-9 w-56 rounded-md border border-akani-card-border bg-akani-page-bg pl-9 pr-3 text-sm text-akani-text-primary placeholder:text-akani-text-muted focus:border-akani-gold focus:outline-none focus:ring-1 focus:ring-akani-gold lg:w-72"
          />
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-akani-text-secondary hover:bg-akani-page-bg"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-akani-navy text-xs font-bold text-white">
          {userName.slice(0, 1).toUpperCase()}
        </span>
      </div>
    </header>
  );
}
