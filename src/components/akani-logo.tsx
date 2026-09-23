/**
 * Akani wordmark, built from CSS/SVG — no logo asset exists in this repo.
 *
 * `variant="dark"` is for permanent use on a dark background (the hero
 * panel) and is hardcoded, since it never changes.
 *
 * `variant="light"` (default) is for the login panel, which can be toggled
 * to dark mode by the reader — but that toggle is client-side state in a
 * *different* component (ThemeScope), and this logo is rendered as
 * server-rendered `children` passed into it, so it has no prop/state route
 * to that toggle. Instead its colors are CSS custom properties with light
 * defaults, overridden by the `[data-login-theme="dark"]` rule in
 * globals.css on the ancestor ThemeScope sets — the override cascades down
 * through `var()` without this component needing to know the toggle exists.
 */
export function AkaniLogo({
  variant = "light",
  size = "sm",
  compact = false,
  className = "",
}: {
  variant?: "light" | "dark";
  size?: "sm" | "lg";
  /** Icon + "AKANI" wordmark only — for persistent app chrome (sidebars,
   * headers) where the full subtitle/tagline lockup is too wide. */
  compact?: boolean;
  className?: string;
}) {
  const isDark = variant === "dark";

  const markBg = isDark ? "#ffffff" : "var(--akani-logo-mark-bg, #07124c)";
  const markFg = isDark ? "#07124c" : "var(--akani-logo-mark-fg, #ffffff)";
  const wordmarkColor = isDark ? "#ffffff" : "var(--akani-logo-wordmark, #07124c)";
  const taglineColor = isDark ? "#ecb100" : "var(--akani-logo-tagline, #697084)";

  const dims = size === "lg" ? 72 : 44;
  const wordmarkSize = size === "lg" ? "text-4xl sm:text-5xl" : "text-xl";
  const productSize = size === "lg" ? "text-base sm:text-lg" : "text-[10px]";
  const tagSize = size === "lg" ? "text-xs sm:text-sm" : "text-[7px]";
  const tagTracking = size === "lg" ? "tracking-[0.35em]" : "tracking-[0.2em]";

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        width={dims}
        height={dims}
        viewBox="0 0 64 64"
        fill="none"
        role="img"
        aria-label="Akani mark"
        className="shrink-0"
      >
        {/* small gold accent dots */}
        <circle cx="6" cy="8" r="2.5" fill="#d6a000" />
        <circle cx="14" cy="4" r="1.6" fill="#ecb100" />
        {/* circular mark */}
        <circle cx="32" cy="34" r="24" style={{ fill: markBg }} />
        <text
          x="32"
          y="43"
          textAnchor="middle"
          fontFamily="var(--font-sans), Arial, sans-serif"
          fontWeight="700"
          fontSize="26"
          style={{ fill: markFg }}
        >
          a
        </text>
        {/* gold vertical block overlapping the mark's edge */}
        <rect x="50" y="18" width="9" height="32" rx="4" fill="#d6a000" />
      </svg>

      <div className="flex flex-col justify-center leading-none">
        <span
          className={`font-bold tracking-tight ${wordmarkSize}`}
          style={{ color: wordmarkColor }}
        >
          AKANI
        </span>
        {!compact && (
          <>
            <span
              className={`font-semibold uppercase tracking-wide ${productSize}`}
              style={{ color: "#d6a000" }}
            >
              Sales Intelligent System
            </span>
            <span
              className={`${size === "lg" ? "mt-2" : "mt-0.5"} font-medium uppercase ${tagTracking} ${tagSize}`}
              style={{ color: taglineColor }}
            >
              Connect &middot; Engage &middot; Grow
            </span>
          </>
        )}
      </div>
    </div>
  );
}
