import { vi } from "vitest";

/*
 * Platform stubs for `isApplePlatform()` (`src/lib/modifier-key.ts`), which reads
 * `navigator.userAgentData.platform` first. Each stub defines an own, configurable `userAgentData`
 * on `navigator` (shadowing Chromium's prototype getter), so a test does not depend on the host OS.
 * Call `restorePlatform()` in `afterEach`.
 */

function stubPlatform(platform: string) {
  Object.defineProperty(navigator, "userAgentData", { value: { platform }, configurable: true });
}

/** Makes `isApplePlatform()` true. */
export function stubMac() {
  stubPlatform("macOS");
}

/** Makes `isApplePlatform()` false, whatever the host OS (a Mac dev machine included). */
export function stubWindows() {
  stubPlatform("Windows");
}

/** Removes a `stubMac` / `stubWindows` stub. */
export function restorePlatform() {
  delete (navigator as { userAgentData?: unknown }).userAgentData;
}

/*
 * EyeDropper API stubs (the ColorPicker's `ColorEyeDropper`). Chromium ships a real `EyeDropper`,
 * whose picker a test cannot drive, so a test either removes it or replaces it with a class whose
 * `open()` it controls. Both go through `vi.stubGlobal`; call `vi.unstubAllGlobals()` in
 * `afterEach`.
 */

/** Replaces `window.EyeDropper` with a class whose `open()` is `open`. */
export function stubEyeDropper(open: () => Promise<{ sRGBHex: string }>) {
  vi.stubGlobal(
    "EyeDropper",
    class {
      open = open;
    },
  );
}

/** Makes the EyeDropper API unavailable (`window.EyeDropper` is `undefined`). */
export function removeEyeDropper() {
  vi.stubGlobal("EyeDropper", undefined);
}
