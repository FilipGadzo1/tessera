/*
 * Shared overlay class strings (Phase C spec §2–§3). Plain strings, server-safe: every overlay
 * composes these so motion, surface and item styling stay identical across components.
 */

/** Motion for anchored popups (Tooltip, Popover, Menu): scales from the anchor. */
export const popupMotion =
  "origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-out data-starting-style:opacity-0 data-starting-style:scale-96 data-ending-style:opacity-0 data-ending-style:scale-96 motion-reduce:transition-none";

/** Motion for centred dialogs: the popup motion without a transform origin. */
export const dialogMotion =
  "transition-[opacity,scale] duration-150 ease-out data-starting-style:opacity-0 data-starting-style:scale-96 data-ending-style:opacity-0 data-ending-style:scale-96 motion-reduce:transition-none";

/** Motion for the dialog backdrop: opacity only. */
export const backdropMotion =
  "transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none";

/**
 * Surface base for Popover and Menu popups (also Select, Combobox and Autocomplete). The 1px
 * border is the surface's frame in forced colors (CanvasText); `outline-hidden` applies in the
 * normal mode only, since in forced colors it becomes a transparent 2px outline that Chromium
 * paints as a second frame outside the border (`forced-colors:outline-none` removes it).
 */
export const popupSurface =
  "rounded-lg border border-border bg-popover text-popover-foreground shadow-lg outline-hidden forced-colors:outline-none";

/**
 * Menu item base: `outline-none` (no outline in any mode), plus a transparent outline on the
 * highlighted item: invisible normally, a system colour in forced-colors mode, so keyboard focus
 * stays visible there and only on the highlighted item.
 */
export const menuItemBase =
  "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 data-highlighted:outline-2 data-highlighted:outline-solid data-highlighted:outline-transparent data-highlighted:-outline-offset-2";

/**
 * Menu popup content shared between `MenuContent` and `ContextMenuContent` (Base UI's `ContextMenu`
 * re-exports the `Menu` popup, and Tessera gives it the same look): scrolls when taller than the
 * viewport, padded for its items. Each caller adds its own minimum width (`MenuContent` sizes to
 * its anchor; `ContextMenuContent`'s anchor is the whole trigger area, so it gets a fixed floor).
 */
export const menuContentClasses = "max-h-(--available-height) overflow-y-auto p-1";
