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
 * Surface base for Popover and Menu popups. Surfaces keep `outline-hidden`: its forced-colors
 * outline is a desirable border on a floating surface (interactive controls use `outline-none`).
 */
export const popupSurface =
  "rounded-lg border border-border bg-popover text-popover-foreground shadow-lg outline-hidden";

/**
 * Menu item base: `outline-none` (no outline in any mode), plus a transparent outline on the
 * highlighted item: invisible normally, a system colour in forced-colors mode, so keyboard focus
 * stays visible there and only on the highlighted item.
 */
export const menuItemBase =
  "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 data-highlighted:outline-2 data-highlighted:outline-solid data-highlighted:outline-transparent data-highlighted:-outline-offset-2";
