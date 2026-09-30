import { useCallback } from "react";

/**
 * Layered Escape for Tessera tooltips (Phase D spec §0).
 *
 * Base UI's tooltip is not part of the floating tree that lets the innermost overlay take Escape,
 * and every overlay listens for Escape on `document`. So a Tessera Tooltip registers itself here
 * while it is open, and the Tessera overlay roots (Dialog, AlertDialog, Popover, Menu, MenuSub,
 * Select, Combobox, Drawer) cancel an Escape close while one is open: the tooltip's own
 * Escape handling closes it, and the outer overlay closes on the next Escape. Nothing stops the
 * event: an app's `keydown` listener still receives it.
 *
 * The same applies to an inner widget that consumes Escape itself (Phase I: a Command palette's
 * input clearing its query): it calls `claimEscape(event)`, and the overlay roots cancel their
 * close for that event.
 */

const openTooltips = new Set<symbol>();

/**
 * The last Escape keydown seen while a tooltip was open, recorded on `window` in the capture
 * phase (before any overlay handles it). Overlays compare against it, so the outcome does not
 * depend on whether the tooltip's listener happens to run before or after theirs. Cleared once
 * the event has finished dispatching (next macrotask), so it is never held longer than needed.
 */
let escapeWithTooltipOpen: Event | null = null;

function recordEscape(event: KeyboardEvent) {
  if (event.key !== "Escape" || openTooltips.size === 0) return;
  escapeWithTooltipOpen = event;
  // Overlays handle Escape synchronously during this dispatch; drop the reference afterwards.
  setTimeout(() => {
    if (escapeWithTooltipOpen === event) escapeWithTooltipOpen = null;
  }, 0);
}

/**
 * Escape keydowns an inner widget consumed (e.g. a Command palette's input clearing its query).
 * A WeakSet, so a claimed event is released with it.
 */
const claimedEscapes = new WeakSet<Event>();

/**
 * Marks an Escape keydown as consumed by an inner widget: the Tessera overlay roots then cancel
 * their Escape close for this event, so the overlay closes on the next Escape. Nothing stops the
 * event; an app's own listeners still receive it.
 */
export function claimEscape(event: Event) {
  claimedEscapes.add(event);
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
 * For an overlay root's `onOpenChange`: when this is an Escape close that something inner takes
 * instead (a Tessera tooltip is, or was at keydown, open; or an inner widget claimed the event with
 * `claimEscape`), cancels the close, lets the event propagate so the tooltip and any app listener
 * still receive it, and returns `true`.
 */
export function yieldEscapeToTooltip(open: boolean, eventDetails: OpenChangeDetails) {
  if (open || eventDetails.reason !== "escape-key") return false;
  if (
    !claimedEscapes.has(eventDetails.event) &&
    openTooltips.size === 0 &&
    eventDetails.event !== escapeWithTooltipOpen
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
 *
 * Every Tessera overlay root with Escape dismissal (Dialog, AlertDialog, Popover, Menu, MenuSub,
 * Select, Combobox, Drawer, …) must wrap its `onOpenChange` with this — otherwise an
 * Escape meant for an open Tooltip, or claimed by an inner widget, also closes that overlay.
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
