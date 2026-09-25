"use client";

import { useEffect, useMemo, useState } from "react";
import { APP_VERSION } from "@/lib/whats-new/version";
import { RELEASE } from "@/lib/whats-new/release";
import { isFresh, KEYS, read, remove, write } from "@/lib/whats-new/storage";
import { shouldOfferRelease, stepsForRole, type Release } from "@/lib/whats-new/tour";
import { Tour } from "./tour";
import { UpdateToast, type ToastKind } from "./update-toast";

const POLL_MS = 3 * 60_000;
// Keep the skeleton up briefly after the new version loads so the change reads
// as one continuous, intentional update rather than a flicker.
const SKELETON_MIN_MS = 600;
const TOUR_DELAY_MS = 2400;
const UPDATED_TOAST_MS = 4000;

export function UpdateManager({ role, release = RELEASE }: { role: string; release?: Release }) {
  const steps = useMemo(() => stepsForRole(release, role), [release, role]);
  const [toast, setToast] = useState<ToastKind | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [touring, setTouring] = useState(false);

  // On load: greet a just-completed update, or offer a tour of an unseen release.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    later(() => {
      const justUpdated = isFresh(KEYS.justUpdated, 5 * 60_000);
      remove(KEYS.justUpdated);
      remove(KEYS.updating);
      later(() => document.documentElement.removeAttribute("data-updating"), SKELETON_MIN_MS);

      const offer = shouldOfferRelease(read(KEYS.releaseSeen), release, role);
      if (justUpdated) {
        later(() => setToast("updated"), SKELETON_MIN_MS);
        if (offer) {
          later(() => {
            setToast(null);
            setTouring(true);
          }, SKELETON_MIN_MS + TOUR_DELAY_MS);
        } else {
          later(() => setToast(null), SKELETON_MIN_MS + UPDATED_TOAST_MS);
        }
      } else if (offer) {
        later(() => setToast("news"), 1200);
      }
    }, 0);

    return () => timers.forEach(clearTimeout);
  }, [release, role]);

  // Watch for a newer deployment while the app is open.
  useEffect(() => {
    if (touring) return;
    let stopped = false;

    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok || stopped) return;
        const { version } = (await res.json()) as { version?: string };
        if (!version || version === APP_VERSION) return;
        if (read(KEYS.dismissedVersion, "session") === version) return;
        setLatestVersion(version);
        // Never interrupt the "updated" greeting or the tour offer.
        setToast((current) => (current === "updated" || current === "news" ? current : "update"));
      } catch {
        // Offline or a blip: try again next time.
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    const first = setTimeout(check, 8000);
    const interval = setInterval(check, POLL_MS);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [touring]);

  // Lets the sidebar's "What's new" button replay the tour.
  useEffect(() => {
    const start = () => {
      if (steps.length > 0) {
        setToast(null);
        setTouring(true);
      }
    };
    window.addEventListener("akani:start-tour", start);
    return () => window.removeEventListener("akani:start-tour", start);
  }, [steps.length]);

  function applyUpdate() {
    // Show the skeleton now; the inline script in the root layout shows it
    // again before first paint after the reload, so it never drops out.
    write(KEYS.updating, String(Date.now()));
    write(KEYS.justUpdated, String(Date.now()));
    document.documentElement.setAttribute("data-updating", "1");
    setToast(null);
    setTimeout(() => window.location.reload(), 900);
  }

  function dismissUpdate() {
    if (latestVersion) write(KEYS.dismissedVersion, latestVersion, "session");
    setToast(null);
  }

  function finishTour() {
    write(KEYS.releaseSeen, release.id);
    setTouring(false);
  }

  function dismissNews() {
    write(KEYS.releaseSeen, release.id);
    setToast(null);
  }

  return (
    <>
      {toast && !touring && (
        <UpdateToast
          kind={toast}
          onPrimary={() => {
            if (toast === "update") applyUpdate();
            else {
              setToast(null);
              setTouring(true);
            }
          }}
          onSecondary={toast === "update" ? dismissUpdate : dismissNews}
        />
      )}
      {touring && steps.length > 0 && <Tour steps={steps} onClose={finishTour} />}
    </>
  );
}
