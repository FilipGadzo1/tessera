import axe from "axe-core";
import { expect } from "vitest";

/**
 * Waits until an opened overlay popup has finished its enter transition: first polls until Base UI
 * drops `data-starting-style`, then awaits the CSS transitions it started (opacity, scale), so
 * geometry and contrast are measured at rest instead of after a fixed sleep.
 */
export async function waitForPopupSettled(popup: Element) {
  await expect.poll(() => popup.hasAttribute("data-starting-style")).toBe(false);
  await Promise.all(popup.getAnimations().map((animation) => animation.finished.catch(() => {})));
}

/**
 * Runs axe over `document.body` (overlays are portalled) with an open overlay and returns the
 * violations and incomplete results as readable strings; both should be `[]`.
 *
 * - `region` is off: it is a page-level rule about the host app (content inside landmarks).
 * - Base UI focus guards (`[data-base-ui-focus-guard]`) are excluded. They are visually hidden,
 *   `aria-hidden` sentinels with `tabindex="0"` that bounce focus back into the popup; with an open
 *   `role="dialog"` axe reports them as `aria-hidden-focus` "needs review" (check
 *   `focusable-modal-open`) because it cannot tell that they redirect focus.
 * - An `aria-valid-attr-value` "needs review" on a trigger with `aria-haspopup` + `aria-controls`
 *   (message key `controlsWithinPopup`) is raised by axe unconditionally. It is dropped only after
 *   verifying here that every referenced id exists in the document.
 */
export async function auditOpenOverlay() {
  const results = await axe.run(
    { include: [document.body], exclude: [["[data-base-ui-focus-guard]"]] },
    { rules: { region: { enabled: false } } },
  );
  const incomplete = results.incomplete.flatMap((result) =>
    result.nodes
      .filter((node) => !(result.id === "aria-valid-attr-value" && controlsResolve(node)))
      .map((node) => `${result.id}: ${node.target}`),
  );
  return {
    violations: results.violations.map((v) => `${v.id}: ${v.help}`),
    incomplete,
  };
}

function controlsResolve(node: axe.NodeResult) {
  const checks = [...node.any, ...node.all, ...node.none];
  if (!checks.every((check) => check.data?.messageKey === "controlsWithinPopup")) return false;
  const element = document.querySelector(String(node.target[0]));
  const ids = element?.getAttribute("aria-controls")?.split(/\s+/) ?? [];
  return ids.length > 0 && ids.every((id) => document.getElementById(id) !== null);
}
