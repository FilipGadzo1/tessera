/**
 * Whether `element`'s resolved writing direction is right-to-left. Reads the computed style, so a
 * `dir` on any ancestor counts (not just the element's own attribute). Browser-only (it needs a
 * mounted element and forces a style read): call it from an event handler or an effect, or from a
 * client-only render path that already holds a mounted element. The shared client read for a
 * component's own direction is `useElementDirection` (`use-element-direction.ts`: on mount, then
 * only when a `dir` attribute changes). The one render-time caller is Drawer's controlled `open`
 * turning true, which reads the mounted portal container before the panel's first render; never
 * read it where it would run on the server or in every render.
 */
export function isRtl(element: Element): boolean {
  return getComputedStyle(element).direction === "rtl";
}
