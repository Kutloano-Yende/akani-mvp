// Covers the app while it reloads into a new version. It is always in the
// page but hidden by CSS; an inline script in the root layout switches it on
// (html[data-updating]) before first paint, so it stays up across the reload
// with no flash of the old or half-loaded page.
export function UpdateSkeleton() {
  return (
    <div
      id="update-skeleton"
      role="status"
      aria-label="Updating to the latest version"
      className="fixed inset-0 z-[100] bg-akani-page-bg"
    >
      <div className="flex h-full w-full">
        <div className="hidden w-60 shrink-0 space-y-3 bg-akani-navy p-5 lg:block">
          <div className="skeleton-dark h-8 w-28" />
          <div className="mt-8 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-dark h-9 w-full" />
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-16 items-center justify-between border-b border-akani-card-border bg-white px-4 sm:px-8">
            <div className="skeleton h-5 w-40" />
            <div className="flex items-center gap-4">
              <div className="skeleton hidden h-9 w-56 sm:block" />
              <div className="skeleton h-8 w-8 rounded-full" />
            </div>
          </div>

          <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-8">
            <div className="skeleton h-4 w-64" />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-akani-card-border bg-white p-5">
                  <div className="skeleton h-3 w-24" />
                  <div className="skeleton mt-4 h-8 w-16" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-akani-card-border bg-white p-6 lg:col-span-2">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton mt-6 h-40 w-full" />
              </div>
              <div className="rounded-xl border border-akani-card-border bg-white p-6">
                <div className="skeleton h-4 w-32" />
                <div className="mt-6 space-y-3">
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-5/6" />
                  <div className="skeleton h-3 w-4/6" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-akani-card-border bg-white px-4 py-2 text-sm font-medium text-akani-text-secondary shadow-md">
        Updating to the latest version…
      </div>
    </div>
  );
}
