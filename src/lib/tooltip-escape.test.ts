import { afterEach, describe, expect, it } from "vitest";
import { registerOpenTooltip, yieldEscapeToTooltip } from "./tooltip-escape";

function details(event: Event, reason = "escape-key") {
  let canceled = false;
  let propagationAllowed = false;
  return {
    reason,
    event,
    cancel: () => {
      canceled = true;
    },
    allowPropagation: () => {
      propagationAllowed = true;
    },
    get isCanceled() {
      return canceled;
    },
    get isPropagationAllowed() {
      return propagationAllowed;
    },
  };
}

const escapeKeydown = () => new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe("yieldEscapeToTooltip", () => {
  it("leaves the close alone when no tooltip is open", () => {
    const d = details(escapeKeydown());
    expect(yieldEscapeToTooltip(false, d)).toBe(false);
    expect(d.isCanceled).toBe(false);
    expect(d.isPropagationAllowed).toBe(false);
  });

  it("cancels an Escape close and allows propagation while a tooltip is open", () => {
    cleanups.push(registerOpenTooltip());
    const d = details(escapeKeydown());
    expect(yieldEscapeToTooltip(false, d)).toBe(true);
    expect(d.isCanceled).toBe(true);
    expect(d.isPropagationAllowed).toBe(true);
  });

  it("ignores other reasons and opening", () => {
    cleanups.push(registerOpenTooltip());
    expect(yieldEscapeToTooltip(false, details(escapeKeydown(), "outside-press"))).toBe(false);
    expect(yieldEscapeToTooltip(true, details(escapeKeydown()))).toBe(false);
  });

  it("still yields when the tooltip already closed during the same Escape", () => {
    // The tooltip's listener may run before the overlay's (it registered first) and unregister it.
    const unregister = registerOpenTooltip();
    const event = escapeKeydown();
    document.body.dispatchEvent(event);
    unregister();
    const d = details(event);
    expect(yieldEscapeToTooltip(false, d)).toBe(true);
    expect(d.isCanceled).toBe(true);
    // A later Escape, with no tooltip open, closes normally.
    const next = escapeKeydown();
    document.body.dispatchEvent(next);
    expect(yieldEscapeToTooltip(false, details(next))).toBe(false);
  });

  it("forgets the recorded Escape once it has finished dispatching", async () => {
    const unregister = registerOpenTooltip();
    const event = escapeKeydown();
    document.body.dispatchEvent(event);
    unregister();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(yieldEscapeToTooltip(false, details(event))).toBe(false);
  });
});
