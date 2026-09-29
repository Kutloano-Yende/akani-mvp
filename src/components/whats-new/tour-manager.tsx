"use client";

import { useEffect, useState } from "react";
import { ONBOARDING } from "@/lib/whats-new/onboarding";
import { RELEASE } from "@/lib/whats-new/release";
import { KEYS, read, write } from "@/lib/whats-new/storage";
import { shouldOfferRelease, type Release } from "@/lib/whats-new/tour";
import { ONBOARDING_SEEN_KEY, OnboardingManager } from "./onboarding-manager";
import { UpdateManager } from "./update-manager";

type Mode = "onboarding" | "updates";

// Decides, once, whether a visitor sees the full onboarding walkthrough or
// the normal "what's new" changelog — never both at once. Someone seeing
// onboarding for the first time doesn't also need a list of past changes,
// so starting onboarding marks the current release as seen too. The
// decision itself is a lazy initial state (not an effect) so it's settled
// before first paint; localStorage is unavailable during server rendering
// (read() returns null there), but both branches render nothing on first
// paint regardless, so there's nothing for that server/client difference
// to actually mismatch.
export function TourManager({ role, release = RELEASE }: { role: string; release?: Release }) {
  const [mode, setMode] = useState<Mode>(() =>
    shouldOfferRelease(read(ONBOARDING_SEEN_KEY), ONBOARDING, role) ? "onboarding" : "updates",
  );

  useEffect(() => {
    if (mode === "onboarding") write(KEYS.releaseSeen, release.id);
    // Only the mount-time decision above should trigger this write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lets Settings → Profile's "Replay getting-started tour" button work
  // even after the initial decision has already landed on "updates".
  useEffect(() => {
    const start = () => setMode("onboarding");
    window.addEventListener("akani:start-onboarding", start);
    return () => window.removeEventListener("akani:start-onboarding", start);
  }, []);

  if (mode === "onboarding") {
    return <OnboardingManager role={role} onFinish={() => setMode("updates")} />;
  }
  return <UpdateManager role={role} release={release} />;
}
