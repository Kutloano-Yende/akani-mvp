"use client";

import { createContext, useContext, useState } from "react";

const ThemeContext = createContext<{ dark: boolean; toggle: () => void } | null>(null);

/**
 * Wraps the left login panel and exposes a light/dark toggle scoped to
 * just this page (via the data-login-theme attribute + matching rules in
 * globals.css) — not a site-wide theme switch.
 */
export function ThemeScope({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
      <div
        data-login-theme={dark ? "dark" : "light"}
        className="relative flex flex-col justify-between gap-5 bg-white p-6 transition-colors duration-300 sm:p-7 lg:p-8"
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function ThemeToggleButton() {
  const ctx = useContext(ThemeContext);
  if (!ctx) return null;
  const { dark, toggle } = ctx;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Toggle dark mode"
      onClick={toggle}
      className="flex items-center gap-1.5"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" stroke="#d6a000" strokeWidth="1.6" />
        <g stroke="#d6a000" strokeWidth="1.6" strokeLinecap="round">
          <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </g>
      </svg>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${dark ? "bg-akani-navy" : "bg-akani-border"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-akani-gold transition-transform ${
            dark ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
          stroke="#697084"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
