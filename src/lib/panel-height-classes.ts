/*
 * Shared by Accordion and Collapsible panels (server-safe, no "use client"). Each panel puts its own
 * Base UI height variable first (`h-(--accordion-panel-height)` / `h-(--collapsible-panel-height)`),
 * then these classes. Base UI sets the variable to the measured content height (px while animating,
 * `auto` once open) and adds `data-starting-style` / `data-ending-style` around the transition.
 *
 * The panel clips for the height animation, but a plain `overflow-hidden` would also clip the
 * focus ring of content flush with its side edges. Instead:
 * - `overflow-clip` + `overflow-clip-margin: 4px` paints up to 4px (2px outline + 2px offset)
 *   past the box on every side without making the panel wider (no negative margins, so no
 *   horizontal scrollbar in a zero-padding scroll parent) and without a scroll container;
 * - `clip-path: inset(0 -4px)` trims the top and bottom back to the box, so the collapsing
 *   panel shows no 4px sliver below the trigger. Horizontally it keeps the same 4px.
 * Browsers without `overflow-clip-margin` clip flush rings (Safari at the time of writing).
 */
export const panelHeightMotionClasses =
  "overflow-clip text-sm transition-[height] duration-200 ease-out [overflow-clip-margin:4px] [clip-path:inset(0_-4px)] data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none";
