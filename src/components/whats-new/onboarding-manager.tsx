"use client";

import { useEffect, useMemo, useState } from "react";
import { ONBOARDING } from "@/lib/whats-new/onboarding";
import { write } from "@/lib/whats-new/storage";
import { stepsForRole } from "@/lib/whats-new/tour";
import { Tour } from "./tour";

export const ONBOARDING_SEEN_KEY = "akani:onboardingSeen";
const START_DELAY_MS = 900;

// Runs the onboarding walkthrough once TourManager has decided to show it,
// then hands control back via onFinish (whether completed or cancelled —
// either way it's been offered, and shouldn't be forced on someone again).
export function OnboardingManager({ role, onFinish }: { role: string; onFinish: () => void }) {
  const steps = useMemo(() => stepsForRole(ONBOARDING, role), [role]);
  const [touring, setTouring] = useState(false);

  useEffect(() => {
    if (steps.length === 0) {
      onFinish();
      return;
    }
    const t = setTimeout(() => setTouring(true), START_DELAY_MS);
    return () => clearTimeout(t);
    // Runs once on mount; steps/onFinish don't change mid-tour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    write(ONBOARDING_SEEN_KEY, ONBOARDING.id);
    onFinish();
  }

  if (!touring) return null;
  return <Tour steps={steps} onClose={finish} />;
}
