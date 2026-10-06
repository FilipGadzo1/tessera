import { toggleFocusClasses } from "../../lib/focus-classes";

/*
 * ColorPicker class strings (spec Phase J §2). Server-safe. The colour surfaces (the area, the
 * channel tracks, the swatches) are pictures of colours, so they keep their authored colours in
 * forced colors (`forced-color-adjust-none`) and draw a CanvasText frame instead.
 */

/**
 * The root: a column of parts. Disabled, the root's 50% is the only fade: the inner Toggles, Button
 * and input would otherwise fade a second time (to 25%), so their own opacity is reset (`!`: their
 * own `data-disabled:` / `disabled:` rules are more specific than a descendant rule).
 */
export const colorPickerClasses =
  "flex w-64 flex-col gap-3 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:**:opacity-100!";

/** The 8px grey-and-white checkerboard behind a translucent colour. */
export const checkerboardClasses =
  "bg-[conic-gradient(#d4d4d4_25%,#fff_0_50%,#d4d4d4_0_75%,#fff_0)] bg-[length:8px_8px]";

/** The saturation/brightness plane (its gradient is an inline style). */
export const colorAreaClasses =
  "relative h-40 w-full touch-none select-none rounded-md forced-color-adjust-none forced-colors:border forced-colors:border-[CanvasText] data-dragging:cursor-grabbing data-disabled:cursor-not-allowed";

/** A hue or alpha track. */
export const colorSliderTrackClasses =
  "relative h-3 w-full touch-none select-none rounded-full forced-color-adjust-none forced-colors:outline forced-colors:outline-1 forced-colors:outline-[CanvasText] data-dragging:cursor-grabbing data-disabled:cursor-not-allowed";

/** The parts every thumb shares: a ringed circle, focused directly. No transitions: it tracks the pointer. */
const thumbBase = `absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.45)] ${toggleFocusClasses} forced-colors:border-[CanvasText] forced-colors:focus-visible:outline-[Highlight]`;

/** The area thumb (positioned by `left` / `top`). */
export const colorAreaThumbClasses = thumbBase;

/** A channel thumb (positioned by `left`, centred on the track). */
export const colorSliderThumbClasses = `top-1/2 ${thumbBase}`;

/** One swatch button. */
export const colorSwatchClasses = `relative size-6 cursor-pointer rounded-md border border-foreground/25 forced-color-adjust-none ${toggleFocusClasses} forced-colors:border-[CanvasText] forced-colors:focus-visible:outline-[Highlight] data-pressed:border-2 data-pressed:border-foreground forced-colors:data-pressed:border-[Highlight] data-disabled:cursor-not-allowed transition-[border-color,outline-color] duration-150 ease-out motion-reduce:transition-none`;
