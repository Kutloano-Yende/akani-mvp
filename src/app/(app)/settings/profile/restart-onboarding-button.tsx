"use client";

export function RestartOnboardingButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("akani:start-onboarding"))}
      className="rounded-md border border-akani-card-border px-4 py-2 text-sm font-medium text-akani-text-primary hover:bg-akani-page-bg"
    >
      Replay getting-started tour
    </button>
  );
}
