"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  computePopoverPosition,
  padRect,
  type Rect,
  type Size,
  type TourStep,
} from "@/lib/whats-new/tour";

const SPOTLIGHT_PAD = 6;
const FIND_TIMEOUT_MS = 4000;

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

// A target counts once it is rendered and horizontally on screen, so a sidebar
// item in a closed mobile drawer (parked off to the left) isn't "found" yet.
// Vertical position is deliberately ignored: a target further down the page is
// still found, then scrolled into view.
function findVisible(target: string): HTMLElement | null {
  const matches = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`);
  for (const el of matches) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth) return el;
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(find: () => T | null, timeoutMs: number): Promise<T | null> {
  const start = Date.now();
  for (;;) {
    const found = find();
    if (found) return found;
    if (Date.now() - start > timeoutMs) return null;
    await sleep(100);
  }
}

export function Tour({
  steps,
  onClose,
}: {
  steps: TourStep[];
  onClose: (completed: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const popoverRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const [popoverSize, setPopoverSize] = useState<Size>({ width: 340, height: 200 });
  const [viewport, setViewport] = useState<Size>({ width: 1024, height: 768 });

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Return focus to whatever had it when the tour opened.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.();
  }, []);

  // Track the viewport and the popover's own size.
  useEffect(() => {
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    const first = setTimeout(updateViewport, 0);
    window.addEventListener("resize", updateViewport);

    const el = popoverRef.current;
    const observer =
      el && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => setPopoverSize({ width: el.offsetWidth, height: el.offsetHeight }))
        : null;
    if (el) observer?.observe(el);

    return () => {
      clearTimeout(first);
      window.removeEventListener("resize", updateViewport);
      observer?.disconnect();
    };
  }, []);

  // Move to the step: navigate/open the drawer if needed, find the target,
  // scroll it into view and highlight it.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      await sleep(0);
      if (cancelled) return;
      setReady(false);

      if (step.path && pathnameRef.current !== step.path) router.push(step.path);
      window.dispatchEvent(new Event(step.openNav ? "akani:open-nav" : "akani:close-nav"));

      if (!step.target) {
        targetRef.current = null;
        setRect(null);
        setReady(true);
        return;
      }

      // An element that exists but takes no space is hidden by the layout (e.g. the
      // search box on phones). It isn't going to appear, so don't make people wait.
      const inDom = document.querySelector(`[data-tour="${step.target}"]`);
      const hiddenByLayout = !!inDom && inDom.getClientRects().length === 0;
      const el =
        hiddenByLayout && !step.path
          ? null
          : await waitFor(() => findVisible(step.target!), FIND_TIMEOUT_MS);
      if (cancelled) return;

      if (el) {
        el.scrollIntoView({ block: "center", inline: "nearest" });
        // Let scrolling and the drawer's slide-in finish before measuring.
        await sleep(step.openNav ? 320 : 60);
        if (cancelled) return;
        targetRef.current = el;
        setRect(measure(el));
      } else {
        // Not on this screen (e.g. hidden on mobile): show the card centred.
        targetRef.current = null;
        setRect(null);
      }
      setReady(true);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [index, step, router]);

  // Keep the highlight glued to its target while the page scrolls or resizes.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (targetRef.current?.isConnected) setRect(measure(targetRef.current));
      });
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, []);

  // Move focus to the primary button whenever a step is shown.
  useEffect(() => {
    if (ready) nextRef.current?.focus();
  }, [ready, index]);

  function goNext() {
    if (isLast) onClose(true);
    else setIndex((i) => i + 1);
  }
  function goBack() {
    if (!isFirst) setIndex((i) => i - 1);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose(false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (isLast) onClose(true);
        else setIndex((i) => i + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Tab") {
        // Keep keyboard focus inside the tour.
        const focusable = popoverRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isLast, onClose]);

  const spot = rect ? padRect(rect, SPOTLIGHT_PAD) : null;
  const position = computePopoverPosition(spot, popoverSize, viewport);

  return (
    <div className="fixed inset-0 z-[90]" aria-live="polite">
      {/* Blocks clicks on the page underneath while the tour is open. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {spot ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl ring-2 ring-akani-gold transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: "0 0 0 9999px rgba(2, 6, 43, 0.66)",
          }}
        />
      ) : (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-akani-navy-dark/65" />
      )}

      {!ready && (
        <div
          role="status"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-4 py-2 text-sm font-medium text-akani-text-secondary shadow-lg"
        >
          Loading…
        </div>
      )}

      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className={`absolute w-[min(340px,calc(100vw-24px))] rounded-xl border border-akani-card-border bg-white p-5 shadow-2xl transition-[top,left,opacity] duration-300 ease-out motion-reduce:transition-none ${
          ready ? "opacity-100" : "opacity-0"
        }`}
        style={{ top: position.top, left: position.left }}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-akani-text-muted">
          Step {index + 1} of {steps.length}
        </p>
        <h2 id="tour-title" className="mt-1 text-base font-semibold text-akani-text-primary">
          {step.title}
        </h2>
        <p id="tour-body" className="mt-1.5 text-sm leading-relaxed text-akani-text-secondary">
          {step.body}
        </p>

        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-akani-gold" : "w-1.5 bg-akani-card-border"
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="rounded-md px-2 py-1.5 text-sm font-medium text-akani-text-secondary hover:text-akani-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-akani-gold"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={goBack}
              disabled={isFirst}
              className="rounded-md border border-akani-card-border px-3 py-1.5 text-sm font-medium text-akani-text-primary hover:bg-akani-page-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-akani-gold disabled:opacity-40"
            >
              Back
            </button>
            <button
              ref={nextRef}
              type="button"
              onClick={goNext}
              className="rounded-md bg-akani-navy px-4 py-1.5 text-sm font-medium text-white hover:bg-akani-deep-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-akani-gold focus-visible:ring-offset-2"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
