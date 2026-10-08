import { toggleFocusClasses } from "../../lib/focus-classes";

/*
 * DataTable's class strings (spec Phase K §7). Server-safe: no directive, no React.
 */

/** The selection column's header and cells. */
export const dataTableSelectHead = "w-10";
/**
 * `forced-color-adjust: auto` repaints the checkbox with system colours inside a selected row,
 * whose `forced-color-adjust: none` (TableRow's Highlight pair) it would otherwise inherit.
 */
export const dataTableSelectCell = "w-10 forced-colors:forced-color-adjust-auto";
/** Single selection: a native radio (`accent-color` keeps system colours in forced colors). */
export const dataTableRadio = `size-4 cursor-pointer accent-primary ${toggleFocusClasses} forced-colors:focus-visible:outline-[Highlight] disabled:cursor-not-allowed`;
/** An end-aligned column's header and cells. */
export const dataTableEndAligned = "text-end";
/** An end-aligned column's sort button hangs into the end padding instead of the start. */
export const dataTableEndSortButton = "ms-0 -me-2";
export const dataTableSortPriority =
  "inline-flex size-4 items-center justify-center rounded-full bg-muted text-[10px] font-medium tabular-nums text-muted-foreground forced-colors:border forced-colors:border-[CanvasText]";
/** A `rowHeader` column's `th scope="row"`: TableCell's look, not a header's. */
export const dataTableRowHeader = "px-3 py-2.5 align-middle text-start font-normal";
export const dataTableEmptyCell = "h-24 text-center text-muted-foreground";
export const dataTableSkeleton = "h-4 w-full max-w-32";
export const dataTableSelectSkeleton = "size-5 rounded-sm";
export const dataTablePagination = "flex flex-wrap items-center justify-between gap-3 text-sm";
export const dataTablePaginationControls = "flex flex-wrap items-center gap-3";
export const dataTableRange = "text-muted-foreground tabular-nums";
export const dataTablePageSize = "w-20";
