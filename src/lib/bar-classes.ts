import { toggleFocusClasses } from "./focus-classes";

/**
 * The shared look of a trigger in a horizontal or vertical bar (MenubarTrigger,
 * NavigationMenuTrigger, and, through `barLinkClasses`, NavigationMenuLink in the bar): an 8-high
 * text row, muted on hover, painted while its popup is open, dimmed and `not-allowed` when
 * disabled, with the 2px focus ring and a Highlight ring / open state in forced colors. The colour
 * changes ease in over 150ms (instant under reduced motion). Server-safe (no "use client").
 */
export const barTriggerClasses = `inline-flex h-8 cursor-pointer select-none items-center rounded-md px-3 text-sm font-medium transition-[color,background-color,border-color,outline-color,box-shadow,translate] duration-150 ease-out motion-reduce:transition-none not-data-disabled:not-data-popup-open:hover:bg-muted data-popup-open:bg-muted data-disabled:cursor-not-allowed data-disabled:opacity-50 ${toggleFocusClasses} forced-colors:focus-visible:outline-[Highlight] forced-colors:data-popup-open:bg-[Highlight] forced-colors:data-popup-open:text-[HighlightText] forced-colors:data-popup-open:forced-color-adjust-none`;
