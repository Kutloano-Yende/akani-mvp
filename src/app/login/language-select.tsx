"use client";

import { useEffect, useRef, useState } from "react";

const LANGUAGES = [{ value: "en", label: "English" }];

/**
 * A native <select>'s open popup is styled by the OS/browser, not by us —
 * it can't be made to match the rest of this design. This renders the
 * closed state to look identical but drives an app-styled listbox instead,
 * following the standard button+listbox ARIA combobox pattern.
 */
export function LanguageSelect() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(LANGUAGES[0].value);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = LANGUAGES.find((l) => l.value === value) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
        onClick={() => setOpen((v) => !v)}
        className="login-lang-select login-label flex h-8 min-w-[92px] cursor-pointer items-center justify-between gap-2 rounded-md border border-akani-border bg-white pl-2.5 pr-2 text-xs font-medium text-akani-navy focus:outline-none focus:ring-1 focus:ring-akani-gold"
      >
        {selected.label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`text-akani-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Language"
          className="login-lang-menu absolute left-0 top-full z-20 mt-1.5 min-w-full overflow-hidden rounded-lg border border-akani-border bg-white py-1 text-xs shadow-lg"
        >
          {LANGUAGES.map((lang) => (
            <li key={lang.value} role="none">
              <button
                type="button"
                role="option"
                aria-selected={lang.value === value}
                onClick={() => {
                  setValue(lang.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left font-medium transition-colors ${
                  lang.value === value
                    ? "bg-akani-bg text-akani-navy"
                    : "text-akani-navy hover:bg-akani-bg"
                }`}
              >
                {lang.label}
                {lang.value === value && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="m5 13 4 4L19 7"
                      stroke="#d6a000"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
