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
 * - Content that Base UI hid behind an open modal (`aria-hidden="true"` on or inside an element
 *   carrying its `data-base-ui-inert` marker, e.g. the page holding the trigger) is reported as
 *   `aria-hidden-focus` "needs review" (check `focusable-modal-open`) for the same reason: axe sees
 *   a modal is open but cannot verify the focus trap. Only such nodes failing nothing but that
 *   check are dropped; the dialog tests assert the focus trap itself. The marker can sit on an
 *   ancestor: Base UI keeps `[aria-live]` regions (e.g. Slider's `<output aria-live="off">`) and
 *   their ancestors exposed, so `aria-hidden` lands on their siblings deeper in the tree while the
 *   marker stays on the top-level outside element. An ancestor marker is accepted only when that
 *   marked element contains an `[aria-live]` region, so an app's own `aria-hidden` is still caught.
 * - A `color-contrast` "needs review" with `elmPartiallyObscuring` on text inside the open modal is
 *   re-checked: axe compares the stacks under each part of the text, *including* the page behind
 *   the backdrop, so text over a boundary between two page elements (e.g. two table headers) is
 *   left undecided although the popup's own opaque background is what sits under it. The node is
 *   dropped only when the popup's content is topmost at the centre of each of the text's rects (so
 *   no marked layer above the modal, e.g. the Toaster, covers it) and axe's color-contrast passes
 *   it with the modal-hidden page (`[data-base-ui-inert]`) made `visibility: hidden` for the
 *   re-check. `elementsFromPoint` skips `pointer-events: none` layers, so such a layer above the
 *   modal is not caught.
 * - An `aria-valid-attr-value` "needs review" on a trigger with `aria-haspopup` + `aria-controls`
 *   (message key `controlsWithinPopup`) is raised by axe unconditionally. axe keeps one review
 *   message per node and overwrites it attribute by attribute, so that key can mask an earlier
 *   broken idref (e.g. `aria-describedby`). The node is dropped only after verifying here that
 *   every idref attribute on it resolves to an element in the document.
 */
export async function auditOpenOverlay() {
  const results = await axe.run(
    { include: [document.body], exclude: [["[data-base-ui-focus-guard]"]] },
    { rules: { region: { enabled: false } } },
  );
  const contrastOverModal = await contrastPassesOverModal(
    results.incomplete
      .filter((result) => result.id === "color-contrast")
      .flatMap((result) => result.nodes.filter(partiallyObscuredInModal)),
  );
  const incomplete = results.incomplete.flatMap((result) =>
    result.nodes
      .filter((node) => !(result.id === "aria-valid-attr-value" && idrefsResolve(node)))
      .filter((node) => !(result.id === "aria-hidden-focus" && hiddenByOpenModal(node)))
      .filter(
        (node) =>
          !(result.id === "color-contrast" && contrastOverModal.has(String(node.target[0]))),
      )
      .map((node) => `${result.id}: ${node.target}`),
  );
  return {
    violations: results.violations.map((v) => `${v.id}: ${v.help}`),
    incomplete,
  };
}

function hiddenByOpenModal(node: axe.NodeResult) {
  const checks = [...node.any, ...node.all, ...node.none];
  if (!checks.every((check) => check.id === "focusable-modal-open")) return false;
  const element = document.querySelector(String(node.target[0]));
  if (element?.getAttribute("aria-hidden") !== "true") return false;
  // The marker on an ancestor counts only for Base UI's aria-live carve-out (see above); an app's
  // own aria-hidden under a marked subtree without a live region is still reported.
  const marked = element.closest("[data-base-ui-inert]");
  return marked === element || marked?.querySelector("[aria-live]") != null;
}

/** Text inside the open modal (not behind it) whose contrast axe left undecided over the page. */
function partiallyObscuredInModal(node: axe.NodeResult) {
  const checks = [...node.any, ...node.all, ...node.none];
  if (!checks.every((check) => check.data?.messageKey === "elmPartiallyObscuring")) return false;
  const element = document.querySelector(String(node.target[0]));
  const modal = element?.closest('[aria-modal="true"]');
  if (!element || !modal || element.closest("[data-base-ui-inert]") !== null) return false;
  // The re-check hides every marked element, including marked layers painted ABOVE the modal
  // (e.g. the Toaster); so the text must be the topmost content at the centre of each of its rects.
  return [...element.getClientRects()].every((rect) => {
    const top = document.elementsFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)[0];
    return top !== undefined && modal.contains(top);
  });
}

/** Re-runs color-contrast on `nodes` with the modal-hidden page hidden; returns those that pass. */
async function contrastPassesOverModal(nodes: axe.NodeResult[]) {
  const passed = new Set<string>();
  const behind = [...document.querySelectorAll<HTMLElement>("[data-base-ui-inert]")];
  if (nodes.length === 0 || behind.length === 0) return passed;
  const visibility = behind.map((element) => element.style.visibility);
  for (const element of behind) element.style.visibility = "hidden";
  try {
    const recheck = await axe.run(
      { include: nodes.map((node) => [String(node.target[0])]) },
      { runOnly: ["color-contrast"] },
    );
    for (const result of recheck.passes) {
      for (const node of result.nodes) passed.add(String(node.target[0]));
    }
  } finally {
    behind.forEach((element, index) => {
      element.style.visibility = visibility[index] ?? "";
    });
  }
  return passed;
}

const idrefAttributes = [
  "aria-controls",
  "aria-describedby",
  "aria-labelledby",
  "aria-owns",
  "aria-activedescendant",
  "aria-errormessage",
  "aria-details",
  "aria-flowto",
];

function idrefsResolve(node: axe.NodeResult) {
  const checks = [...node.any, ...node.all, ...node.none];
  if (!checks.every((check) => check.data?.messageKey === "controlsWithinPopup")) return false;
  const element = document.querySelector(String(node.target[0]));
  if (!element?.hasAttribute("aria-controls")) return false;
  return idrefAttributes.every((name) => {
    const value = element.getAttribute(name);
    if (value === null) return true;
    const ids = value.trim().split(/\s+/).filter(Boolean);
    return ids.length > 0 && ids.every((id) => document.getElementById(id) !== null);
  });
}
