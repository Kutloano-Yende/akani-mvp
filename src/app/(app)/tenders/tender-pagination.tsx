"use client";

import { useRouter } from "next/navigation";

/**
 * Plain next/link navigation from the bare, nav-prefetched `/tenders` (no
 * searchParams) silently served a stale cached render for ANY new
 * searchParams -- the URL updated but the list didn't (confirmed live:
 * clicking Next from the unfiltered landing page left the page showing
 * "Page 1" and the exact same 50 rows, even though window.location had
 * already moved to ?page=2). Same root cause as the filter form's
 * router.push, fixed the same way: push, then explicitly refresh.
 */
export function TenderPagination({
  page,
  hasMore,
  prevHref,
  nextHref,
}: {
  page: number;
  hasMore: boolean;
  prevHref: string;
  nextHref: string;
}) {
  const router = useRouter();

  function go(href: string) {
    router.push(href);
    router.refresh();
  }

  if (page <= 1 && !hasMore) return null;

  return (
    <div className="flex items-center justify-between text-sm">
      {page > 1 ? (
        <button
          type="button"
          onClick={() => go(prevHref)}
          className="font-medium text-akani-text-primary hover:text-akani-gold"
        >
          ← Previous
        </button>
      ) : (
        <span />
      )}
      <span className="text-akani-text-muted">Page {page}</span>
      {hasMore ? (
        <button
          type="button"
          onClick={() => go(nextHref)}
          className="font-medium text-akani-text-primary hover:text-akani-gold"
        >
          Next →
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
