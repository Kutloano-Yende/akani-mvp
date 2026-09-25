export type Placement = "top" | "bottom" | "left" | "right" | "center";

export type TourStep = {
  id: string;
  // Matches an element's data-tour="..." attribute. Omit for a centred card.
  target?: string;
  // Navigate here first if the target lives on another page.
  path?: string;
  // Open the mobile navigation drawer so a sidebar target is visible.
  openNav?: boolean;
  // Only show this step to these roles.
  roles?: string[];
  title: string;
  body: string;
};

export type Release = { id: string; steps: TourStep[] };

export type Rect = { top: number; left: number; width: number; height: number };
export type Size = { width: number; height: number };

export function stepsForRole(release: Release, role: string): TourStep[] {
  return release.steps.filter((s) => !s.roles || s.roles.includes(role));
}

// Offer a tour when this release hasn't been seen and has something to show.
export function shouldOfferRelease(seenId: string | null, release: Release, role: string): boolean {
  return seenId !== release.id && stepsForRole(release, role).length > 0;
}

export function padRect(rect: Rect, pad: number): Rect {
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

// Places the popover beside the highlighted element on the first side it fully
// fits (below, above, right, left), otherwise on the side with most room, and
// always keeps it inside the viewport. With no target it is centred.
export function computePopoverPosition(
  target: Rect | null,
  popover: Size,
  viewport: Size,
  gap = 14,
  margin = 12,
): { top: number; left: number; placement: Placement } {
  if (!target) {
    return {
      top: Math.max(margin, (viewport.height - popover.height) / 2),
      left: Math.max(margin, (viewport.width - popover.width) / 2),
      placement: "center",
    };
  }

  const space = {
    bottom: viewport.height - (target.top + target.height) - gap - margin,
    top: target.top - gap - margin,
    right: viewport.width - (target.left + target.width) - gap - margin,
    left: target.left - gap - margin,
  };
  const need = {
    bottom: popover.height,
    top: popover.height,
    right: popover.width,
    left: popover.width,
  };

  const order: Exclude<Placement, "center">[] = ["bottom", "top", "right", "left"];
  const fits = order.find((side) => space[side] >= need[side]);
  const placement = fits ?? order.reduce((best, side) => (space[side] > space[best] ? side : best));

  const centerX = target.left + target.width / 2;
  const centerY = target.top + target.height / 2;
  let top: number;
  let left: number;

  if (placement === "bottom") {
    top = target.top + target.height + gap;
    left = centerX - popover.width / 2;
  } else if (placement === "top") {
    top = target.top - gap - popover.height;
    left = centerX - popover.width / 2;
  } else if (placement === "right") {
    top = centerY - popover.height / 2;
    left = target.left + target.width + gap;
  } else {
    top = centerY - popover.height / 2;
    left = target.left - gap - popover.width;
  }

  return {
    top: clamp(top, margin, viewport.height - popover.height - margin),
    left: clamp(left, margin, viewport.width - popover.width - margin),
    placement,
  };
}
