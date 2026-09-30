/**
 * Whether `element`'s resolved writing direction is right-to-left. Reads the computed style, so a
 * `dir` on any ancestor counts (not just the element's own attribute). Browser-only: call it from
 * an event handler or an effect, never during render.
 */
export function isRtl(element: Element): boolean {
  return getComputedStyle(element).direction === "rtl";
}
