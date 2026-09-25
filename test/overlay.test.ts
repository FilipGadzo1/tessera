import { afterEach, describe, expect, it } from "vitest";
import { auditOpenOverlay } from "./overlay";

let fixture: HTMLElement | null = null;

function mount(html: string) {
  fixture = document.createElement("div");
  fixture.innerHTML = html;
  document.body.append(fixture);
}

afterEach(() => {
  fixture?.remove();
  fixture = null;
});

describe("auditOpenOverlay", () => {
  it("drops the controlsWithinPopup review when every idref on the trigger resolves", async () => {
    mount(
      `<button type="button" aria-describedby="hint" aria-haspopup="dialog" aria-expanded="true" aria-controls="panel">Open</button>
       <p id="hint">Hint</p><div id="panel">Panel</div>`,
    );
    const { violations, incomplete } = await auditOpenOverlay();
    expect(violations).toEqual([]);
    expect(incomplete).toEqual([]);
  });

  // axe keeps one needsReview entry per node and overwrites it attribute by attribute, so a broken
  // aria-describedby read before aria-controls is reported only as `controlsWithinPopup`.
  it("still reports a trigger whose aria-describedby is broken, even behind aria-controls", async () => {
    mount(
      `<button type="button" aria-describedby="missing" aria-haspopup="dialog" aria-expanded="true" aria-controls="panel">Open</button>
       <div id="panel">Panel</div>`,
    );
    const { incomplete } = await auditOpenOverlay();
    expect(incomplete).toEqual(["aria-valid-attr-value: button"]);
  });

  // aria-valid-attr-value skips aria-errormessage, so behind aria-controls only the
  // controlsWithinPopup review remains; the audit must still keep it.
  it("still reports a trigger whose aria-errormessage is broken, even behind aria-controls", async () => {
    mount(
      `<button type="button" aria-errormessage="missing" aria-haspopup="dialog" aria-expanded="true" aria-controls="panel">Open</button>
       <div id="panel">Panel</div>`,
    );
    const { incomplete } = await auditOpenOverlay();
    expect(incomplete).toEqual(["aria-valid-attr-value: button"]);
  });

  // A broken aria-details / aria-flowto is a hard violation in axe, never masked by the review.
  it.each(["aria-details", "aria-flowto"])(
    "still reports a trigger whose %s is broken",
    async (attribute) => {
      mount(
        `<button type="button" ${attribute}="missing" aria-haspopup="dialog" aria-expanded="true" aria-controls="panel">Open</button>
         <div id="panel">Panel</div>`,
      );
      const { violations } = await auditOpenOverlay();
      expect(violations.some((v) => v.startsWith("aria-valid-attr-value"))).toBe(true);
    },
  );

  it("still reports a trigger whose aria-controls is broken", async () => {
    mount(
      `<button type="button" aria-haspopup="dialog" aria-expanded="true" aria-controls="missing">Open</button>`,
    );
    const { incomplete } = await auditOpenOverlay();
    expect(incomplete).toEqual(["aria-valid-attr-value: button"]);
  });

  it("drops focusable content Base UI hid behind an open modal (data-base-ui-inert)", async () => {
    mount(
      `<div aria-hidden="true" data-base-ui-inert><button type="button">Behind</button></div>
       <div role="dialog" aria-label="Open dialog"><button type="button">Inside</button></div>`,
    );
    const { violations, incomplete } = await auditOpenOverlay();
    expect(violations).toEqual([]);
    expect(incomplete).toEqual([]);
  });

  // Base UI keeps [aria-live] regions (and their ancestors) exposed behind a modal, so aria-hidden
  // lands on their siblings while the marker stays on the top-level outside element.
  it("drops focusable content hidden inside a marked element (an aria-live region kept exposed)", async () => {
    mount(
      `<div data-base-ui-inert><div aria-hidden="true"><button type="button">Behind</button></div>
         <output aria-live="off">3</output></div>
       <div role="dialog" aria-label="Open dialog"><button type="button">Inside</button></div>`,
    );
    const { violations, incomplete } = await auditOpenOverlay();
    expect(violations).toEqual([]);
    expect(incomplete).toEqual([]);
  });

  // Popup text wrapping onto two lines, each over a different page row behind the backdrop.
  const modalOverTwoRows = (textColor: string, above = "") =>
    `<div data-base-ui-inert aria-hidden="true">
       <div style="height:30px;background:#eee"></div>
       <div style="height:30px;background:#ddd"></div>
     </div>${above}
     <div style="position:fixed;inset:0;z-index:9;background:rgb(0 0 0 / 0.5)"></div>
     <div role="dialog" aria-modal="true" aria-label="Open dialog"
       style="position:fixed;top:0;left:0;z-index:10;width:60px;padding:5px;background:#fff">
       <p style="margin:0;line-height:30px;color:${textColor}">Order total</p>
     </div>`;

  // axe compares the stacks under each part of the text, page behind the backdrop included, so
  // popup text over two different page elements is left undecided.
  it("drops an undecided contrast over the modal-hidden page when the re-check passes", async () => {
    mount(modalOverTwoRows("#111"));
    const { violations, incomplete } = await auditOpenOverlay();
    expect(violations).toEqual([]);
    expect(incomplete).toEqual([]);
  });

  it("keeps an undecided contrast over the modal-hidden page when the re-check fails", async () => {
    mount(modalOverTwoRows("#ccc"));
    const { incomplete } = await auditOpenOverlay();
    expect(incomplete).toEqual(["color-contrast: p"]);
  });

  // A marked layer painted ABOVE the modal (e.g. the Toaster, z 70) really obscures the text; axe
  // drops fixed elements above the target from the stack, so only the geometry check catches it.
  it("keeps an undecided contrast when a marked layer above the modal covers the text", async () => {
    mount(
      modalOverTwoRows(
        "#111",
        `<div data-base-ui-inert style="position:fixed;top:35px;left:0;z-index:20;width:200px;height:30px;background:#333"></div>`,
      ),
    );
    const { incomplete } = await auditOpenOverlay();
    expect(incomplete).toEqual(["color-contrast: p"]);
  });

  // The ancestor-marker allowance is only for Base UI's aria-live carve-out; an app's own
  // aria-hidden around focusable content under a marked subtree is still a finding.
  it("still reports app-set aria-hidden focusable content under a marked ancestor with no aria-live", async () => {
    mount(
      `<div data-base-ui-inert><div aria-hidden="true" id="app-hidden"><button type="button">Behind</button></div></div>
       <div role="dialog" aria-label="Open dialog"><button type="button">Inside</button></div>`,
    );
    const { incomplete } = await auditOpenOverlay();
    expect(incomplete).toEqual(["aria-hidden-focus: #app-hidden"]);
  });

  it("still reports aria-hidden focusable content that Base UI did not hide", async () => {
    mount(
      `<div aria-hidden="true"><button type="button">Behind</button></div>
       <div role="dialog" aria-label="Open dialog"><button type="button">Inside</button></div>`,
    );
    const { incomplete } = await auditOpenOverlay();
    expect(incomplete).toEqual(['aria-hidden-focus: div[aria-hidden="true"]']);
  });
});
