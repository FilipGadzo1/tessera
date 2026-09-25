import { cdp } from "vitest/browser";

/**
 * Parks the real (Playwright) pointer at the page's top-left corner, where no test renders a
 * control, so hover styles and hover-opened popups never leak into the next test. Sent through
 * CDP rather than `userEvent.hover(document.body, …)`: when a test leaves a modal (and its
 * full-screen backdrop) open, Playwright's actionability check sees the backdrop intercepting the
 * pointer and times out. Registered globally in `test/setup.ts` (`afterEach`).
 */
export async function parkPointer(): Promise<void> {
  await cdp().send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 0, y: 0 });
}
