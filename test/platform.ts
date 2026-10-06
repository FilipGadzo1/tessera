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
