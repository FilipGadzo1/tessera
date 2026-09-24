import { cdp } from "vitest/browser";

/*
 * Real media emulation through the Chrome DevTools Protocol (vitest/browser `cdp()`), so the
 * `forced-colors:` / `motion-reduce:` variants actually match and tests check the cascade, not
 * just the class list. Each call replaces every emulated feature; reset in `afterEach`.
 */

/** Emulates (or, with `false`, clears) `forced-colors: active` (Windows High Contrast). */
export async function emulateForcedColors(active: boolean): Promise<void> {
  await cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "forced-colors", value: active ? "active" : "" }],
  });
}

/** Emulates (or, with `false`, clears) `prefers-reduced-motion: reduce`. */
export async function emulateReducedMotion(active: boolean): Promise<void> {
  await cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: active ? "reduce" : "" }],
  });
}

/** Resolves a CSS colour keyword (e.g. the system colour `Highlight`) to its computed rgb() string. */
export function systemColor(color: string) {
  const probe = document.createElement("div");
  probe.style.color = color;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}
