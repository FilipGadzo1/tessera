import { cdp } from "vitest/browser";

/*
 * Real media emulation through the Chrome DevTools Protocol (vitest/browser `cdp()`), so the
 * `forced-colors:` / `motion-reduce:` variants actually match and tests check the cascade, not
 * just the class list. Each call REPLACES every emulated feature (that is how the CDP command
 * works), so combine features that must hold at once with a single `emulateMedia([...])` call
 * rather than two sequential `emulateForcedColors` / `emulateReducedMotion` calls, and reset with
 * `resetEmulatedMedia()` in `afterEach` rather than an arbitrary single-feature "off" call.
 */

/** Emulates (or, with an empty array, clears) a set of media features at once. */
export async function emulateMedia(features: { name: string; value: string }[]): Promise<void> {
  await cdp().send("Emulation.setEmulatedMedia", { features });
}

/** Clears every emulated media feature (forced colors, reduced motion, …). */
export async function resetEmulatedMedia(): Promise<void> {
  await emulateMedia([]);
}

/** Emulates (or, with `false`, clears) `forced-colors: active` (Windows High Contrast). */
export async function emulateForcedColors(active: boolean): Promise<void> {
  await emulateMedia([{ name: "forced-colors", value: active ? "active" : "" }]);
}

/** Emulates (or, with `false`, clears) `prefers-reduced-motion: reduce`. */
export async function emulateReducedMotion(active: boolean): Promise<void> {
  await emulateMedia([{ name: "prefers-reduced-motion", value: active ? "reduce" : "" }]);
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
