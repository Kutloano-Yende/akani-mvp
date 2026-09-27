import Image from "next/image";

/**
 * The official Akani BEE Ratings logo (from the brand PDF), used across the
 * whole app now — public pages already showed it via BrandLogo; this brings
 * the signed-in app and the login page in line with it too.
 *
 * The source artwork (public/email/akani-logo.png) is navy/gold ink on a
 * solid white background. `public/brand/akani-logo-{light,dark}-{full,compact}.png`
 * are derived from it once (transparent background; the dark set turns the
 * navy ink white so it reads on a dark background, keeping the gold ink
 * as-is) — a one-off asset step, not a build step.
 */
const ASPECT = { full: 480 / 169, compact: 480 / 144, icon: 160 / 144 };

export function AkaniLogo({
  variant = "light",
  size = "sm",
  compact = false,
  icon = false,
  className = "",
}: {
  variant?: "light" | "dark";
  size?: "sm" | "lg";
  /** Icon + wordmark only, no "Together we build" tagline — for persistent
   * app chrome (sidebars, headers) where the full lockup is too tall. */
  compact?: boolean;
  /** Just the circular mark, no wordmark at all — for the collapsed sidebar. */
  icon?: boolean;
  className?: string;
}) {
  const crop = icon ? "icon" : compact ? "compact" : "full";
  const width = size === "lg" ? 280 : icon ? 36 : compact ? 130 : 170;
  const aspect = ASPECT[crop];
  const height = Math.round(width / aspect);

  if (variant === "dark") {
    // The hero panel's background is hardcoded dark and never toggles, so
    // this never needs to swap at runtime (unlike the "light" case below).
    return (
      <Image
        src={`/brand/akani-logo-dark-${crop}.png`}
        alt="Akani BEE Ratings — Together we build"
        width={width}
        height={height}
        priority
        className={className}
      />
    );
  }

  // The login panel can be toggled to a dark theme by the reader (client-side
  // state in ThemeScope, a *different* component this one has no prop/state
  // route to). Both images are rendered and CSS (the [data-login-theme="dark"]
  // rule in globals.css on the ancestor ThemeScope sets) picks which one is
  // visible, the same way every other login-panel element swaps colors.
  return (
    <span className={`relative inline-block ${className}`} style={{ width, height }}>
      <Image
        src={`/brand/akani-logo-light-${crop}.png`}
        alt="Akani BEE Ratings — Together we build"
        width={width}
        height={height}
        priority
        className="login-logo-light absolute inset-0"
      />
      <Image
        src={`/brand/akani-logo-dark-${crop}.png`}
        alt=""
        aria-hidden="true"
        width={width}
        height={height}
        priority
        className="login-logo-dark absolute inset-0"
      />
    </span>
  );
}
