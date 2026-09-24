import { useCallback } from "react";

/**
 * Layered Escape for Tessera tooltips (Phase D spec §0).
 *
 * Base UI's tooltip is not part of the floating tree that lets the innermost overlay take Escape,
 * and every overlay listens for Escape on `document`. So a Tessera Tooltip registers itself here
 * while it is open, and the Tessera overlay roots (Dialog, AlertDialog, Popover, Menu) cancel an
 * Escape close while one is open: the tooltip's own Escape handling closes it, and the outer
 * overlay closes on the next Escape. Nothing stops the event: an app's `keydown` listener still
 * receives it.
 */

const openTooltips = new Set<symbol>();

/**
 * The last Escape keydown seen while a tooltip was open, recorded on `window` in the capture
 * phase (before any overlay handles it). Overlays compare against it, so the outcome does not
 * depend on whether the tooltip's listener happens to run before or after theirs.
 */
let escapeWithTooltipOpen: Event | null = null;

function recordEscape(event: KeyboardEvent) {
  if (event.key === "Escape" && openTooltips.size > 0) escapeWithTooltipOpen = event;
}

/** Marks a tooltip as open; returns the cleanup that unmarks it. */
export function registerOpenTooltip() {
  const token = Symbol("tooltip");
  if (openTooltips.size === 0) window.addEventListener("keydown", recordEscape, true);
  openTooltips.add(token);
  return () => {
    openTooltips.delete(token);
    if (openTooltips.size === 0) window.removeEventListener("keydown", recordEscape, true);
  };
}

interface OpenChangeDetails {
  reason: string;
  event: Event;
  cancel: () => void;
  allowPropagation: () => void;
}

/**
 * For an overlay root's `onOpenChange`: when this is an Escape close while a Tessera tooltip is
 * (or was, at keydown) open, cancels the close, lets the event propagate so the tooltip and any
 * app listener still receive it, and returns `true`.
 */
export function yieldEscapeToTooltip(open: boolean, eventDetails: OpenChangeDetails) {
  if (
    open ||
    eventDetails.reason !== "escape-key" ||
    (openTooltips.size === 0 && eventDetails.event !== escapeWithTooltipOpen)
  ) {
    return false;
  }
  eventDetails.cancel();
  eventDetails.allowPropagation();
  return true;
}

/**
 * Wraps an overlay root's `onOpenChange` with `yieldEscapeToTooltip`; a cancelled close is not
 * forwarded to the caller.
 */
export function useLayeredEscape<Details extends OpenChangeDetails>(
  onOpenChange: ((open: boolean, eventDetails: Details) => void) | undefined,
) {
  return useCallback(
    (open: boolean, eventDetails: Details) => {
      if (yieldEscapeToTooltip(open, eventDetails)) return;
      onOpenChange?.(open, eventDetails);
    },
    [onOpenChange],
  );
}
