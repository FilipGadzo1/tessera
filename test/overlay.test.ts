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

  it("still reports aria-hidden focusable content that Base UI did not hide", async () => {
    mount(
      `<div aria-hidden="true"><button type="button">Behind</button></div>
       <div role="dialog" aria-label="Open dialog"><button type="button">Inside</button></div>`,
    );
    const { incomplete } = await auditOpenOverlay();
    expect(incomplete).toEqual(['aria-hidden-focus: div[aria-hidden="true"]']);
  });
});
