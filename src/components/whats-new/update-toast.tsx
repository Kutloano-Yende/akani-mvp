"use client";

export type ToastKind = "update" | "updated" | "news";

const COPY: Record<ToastKind, { title: string; body: string; primary?: string; secondary?: string }> = {
  update: {
    title: "A new version is available",
    body: "Update to get the latest features. This page will reload.",
    primary: "Update now",
    secondary: "Later",
  },
  updated: {
    title: "You're up to date",
    body: "Akani has been updated. Here's what's new.",
  },
  news: {
    title: "New in Akani",
    body: "Take a quick tour of what's changed.",
    primary: "Show me",
    secondary: "Dismiss",
  },
};

export function UpdateToast({
  kind,
  onPrimary,
  onSecondary,
}: {
  kind: ToastKind;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const copy = COPY[kind];

  return (
    <div
      role="status"
      aria-live="polite"
      className="akani-toast-in fixed bottom-4 left-4 right-4 z-[80] sm:left-auto sm:w-96"
    >
      <div className="flex gap-3 rounded-xl border border-akani-card-border bg-white p-4 shadow-lg">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            kind === "updated" ? "bg-akani-success-bg text-akani-success" : "bg-akani-navy text-akani-gold"
          }`}
        >
          {kind === "updated" ? <CheckIcon /> : <SparkleIcon />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-akani-text-primary">{copy.title}</p>
          <p className="mt-0.5 text-sm text-akani-text-secondary">{copy.body}</p>
          {copy.primary && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={onPrimary}
                className="rounded-md bg-akani-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-akani-deep-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-akani-gold"
              >
                {copy.primary}
              </button>
              <button
                type="button"
                onClick={onSecondary}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-akani-text-secondary hover:bg-akani-page-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-akani-gold"
              >
                {copy.secondary}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
