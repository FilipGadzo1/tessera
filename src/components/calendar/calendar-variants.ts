import { cn } from "../../lib/cn";
import { toggleFocusClasses } from "../../lib/focus-classes";
import { buttonVariants } from "../button/button-variants";

/** Root: one month stacks header over grid; two months sit side by side, each with its own grid. */
export function calendarRootClasses(numberOfMonths: number): string {
  return cn(
    "inline-flex p-3 text-foreground",
    numberOfMonths > 1 ? "flex-row gap-6" : "flex-col gap-3",
  );
}

export const calendarMonthClasses = "flex flex-col gap-3";
export const calendarHeaderClasses = "flex items-center justify-between gap-2";
/** The live caption: visually hidden since Task 8 (the month and year buttons are the visible caption). */
export const calendarCaptionClasses = "sr-only";
export const calendarCaptionGroupClasses = "flex min-w-0 items-center";
/** The month and year buttons in the header (Task 8). */
export const calendarCaptionButtonClasses = buttonVariants({
  variant: "ghost",
  color: "neutral",
  size: "sm",
  className: "px-1.5 font-medium forced-colors:focus-visible:outline-[Highlight]",
});
/** The header's previous/next buttons. */
export const calendarNavClasses = buttonVariants({
  variant: "ghost",
  color: "neutral",
  size: "icon-sm",
  className: "forced-colors:focus-visible:outline-[Highlight]",
});
export const calendarGridClasses = "border-collapse";
export const calendarWeekdayClasses = "size-9 p-0 text-xs font-normal text-muted-foreground";
export const calendarCellClasses = "p-0 text-center";

/**
 * The month and year views' grid: the day grid's footprint (7 × size-9 wide; the weekday row plus
 * six weeks, 7 × size-9 high), so switching views never resizes the calendar or its popover.
 */
export const calendarViewGridClasses = "h-63 w-63 table-fixed";
export const calendarViewCellClasses = "p-1 text-center";

const focusRing = cn(
  toggleFocusClasses,
  "forced-colors:focus-visible:outline-[Highlight] focus-visible:z-10",
);
/** Today (or the current month/year): bold plus a 2px bar under the text (positioned per cell). */
const currentMarker =
  "font-semibold after:pointer-events-none after:absolute after:bottom-1 after:rounded-full after:border-t-2 after:border-current";
// *Amended (Task 6 fix round 1, see design-system-v2 spec §4)*: `forced-color-adjust: none`
// disables Chromium's forced-colors text backplate, which otherwise paints Canvas over the
// `Highlight` fill and hides `HighlightText` (the text, and — via inheritance — the `::after`
// today bar's `border-[HighlightText]` colour). The general
// `forced-colors:focus-visible:outline-[Highlight]` rule still applies unaffected: it is itself an
// explicit system-colour value, not something `forced-color-adjust` would otherwise auto-force.
const selectedClasses =
  "bg-primary text-primary-foreground not-data-disabled:hover:bg-primary-hover forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:not-data-disabled:hover:bg-[Highlight] forced-colors:after:border-[HighlightText] forced-colors:forced-color-adjust-none";
const disabledClasses = "cursor-not-allowed line-through opacity-40";

/** A month or year cell's button in the month and year views (Task 8). */
export function calendarViewItemClasses(state: {
  current: boolean;
  selected: boolean;
  disabled: boolean;
}): string {
  return cn(
    "relative inline-flex h-13.75 w-full cursor-pointer select-none items-center justify-center rounded-md text-sm tabular-nums",
    focusRing,
    "not-data-disabled:hover:bg-muted",
    state.current &&
      cn(currentMarker, "after:bottom-2 after:left-1/2 after:w-3 after:-translate-x-1/2"),
    state.selected && selectedClasses,
    state.disabled && disabledClasses,
  );
}

/** The state a day button renders with (mirrored by its `data-*` attributes). */
export interface CalendarDayState {
  today: boolean;
  outside: boolean;
  disabled: boolean;
  /** A single selected day, or either end of a range. */
  selected: boolean;
  rangeStart: boolean;
  rangeEnd: boolean;
  rangeMiddle: boolean;
  rangePreview: boolean;
  /** The band continues past this day towards the inline end (square its end corners). */
  bandAfter: boolean;
  /** The band continues past this day towards the inline start (square its start corners). */
  bandBefore: boolean;
}

/**
 * Day button classes. Composed in order with tailwind-merge so a later state's colours replace
 * an earlier one's (outside → range band → selected) instead of relying on CSS source order.
 */
export function calendarDayClasses(state: CalendarDayState): string {
  return cn(
    "relative inline-flex size-9 cursor-pointer select-none items-center justify-center rounded-md text-sm tabular-nums",
    focusRing,
    "not-data-disabled:hover:bg-muted",
    // Today: bold, plus a 2px bar under the number. A border (not a background) so it survives
    // forced colors, where backgrounds are repainted but borders keep the text colour.
    state.today && cn(currentMarker, "after:inset-x-3"),
    state.outside && "text-muted-foreground",
    (state.rangeMiddle || state.rangePreview) &&
      "rounded-none bg-primary-soft text-primary-soft-foreground not-data-disabled:hover:bg-primary-soft-hover forced-colors:border-y forced-colors:border-[CanvasText]",
    state.rangePreview && "forced-colors:border-dashed",
    state.selected && selectedClasses,
    state.bandAfter && "rounded-e-none",
    state.bandBefore && "rounded-s-none",
    state.disabled && disabledClasses,
  );
}
