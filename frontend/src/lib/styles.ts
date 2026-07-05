/**
 * Shared Tailwind utility class groups — reuse these across every skill so
 * the design language stays consistent instead of each page/component
 * reinventing its own spacing, elevation, and color choices.
 */

/**
 * Standard hover/interaction transition timing — use on any interactive
 * element (cards, buttons, chips) so motion feels consistent app-wide.
 */
export const transitionBase = "transition-all duration-200 ease-out"

/** Base styling for a card-like surface (skill cards, panel modules, etc.). */
export const cardBase =
  "bg-surface rounded-2xl shadow-card border border-border-subtle p-5 transition-all duration-200"

/** Add alongside cardBase for cards that are clickable/navigable. */
export const cardHover =
  "hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer"

/**
 * Base shell for a page or workspace panel: canvas background, consistent
 * padding, and fills its container — so nothing is left with the browser's
 * unstyled default white background/margins.
 */
export const pageShell = "h-full w-full bg-canvas px-8 py-6"

/** Base styling for pill-shaped labels (status badges, filter chips, etc.). */
export const pillBase =
  "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150"

/** Consistent vertical spacing between major blocks on a page. */
export const sectionGap = "space-y-6"
