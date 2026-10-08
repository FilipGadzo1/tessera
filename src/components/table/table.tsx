import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

export interface TableProps extends ComponentProps<"table"> {
  /** className for the scroll container wrapping the `<table>`. */
  containerClassName?: string;
  /** The `<table>`'s `data-slot` (the container keeps `table-container`). @default "table" */
  "data-slot"?: string;
}

/**
 * A `<table>` inside a horizontally-scrollable container, so wide tables don't overflow the page.
 * `className` styles the table; `containerClassName` styles the wrapping `div`.
 */
export function Table({
  className,
  containerClassName,
  "data-slot": dataSlot = "table",
  ...props
}: TableProps) {
  return (
    <div
      data-slot="table-container"
      className={cn("relative w-full overflow-x-auto", containerClassName)}
    >
      <table
        {...props}
        data-slot={dataSlot}
        className={cn("w-full caption-bottom text-sm", className)}
      />
    </div>
  );
}

export interface TableHeaderProps extends ComponentProps<"thead"> {
  /** @default "table-header" */
  "data-slot"?: string;
}

/** `<thead>`. Rows inside lose their bottom border on the last row via `TableBody`'s selector. */
export function TableHeader({
  className,
  "data-slot": dataSlot = "table-header",
  ...props
}: TableHeaderProps) {
  return <thead {...props} data-slot={dataSlot} className={cn("[&_tr]:border-b", className)} />;
}

export interface TableBodyProps extends ComponentProps<"tbody"> {
  /** @default "table-body" */
  "data-slot"?: string;
}

/** `<tbody>`. Its last row has no bottom border. */
export function TableBody({
  className,
  "data-slot": dataSlot = "table-body",
  ...props
}: TableBodyProps) {
  return (
    <tbody
      {...props}
      data-slot={dataSlot}
      className={cn("[&_tr:last-child]:border-0", className)}
    />
  );
}

export type TableFooterProps = ComponentProps<"tfoot">;

/** `<tfoot>`, styled distinctly from the body (muted background, medium weight). */
export function TableFooter({ className, ...props }: TableFooterProps) {
  return (
    <tfoot
      {...props}
      data-slot="table-footer"
      className={cn(
        "border-t border-border bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className,
      )}
    />
  );
}

export interface TableRowProps extends ComponentProps<"tr"> {
  /** @default "table-row" */
  "data-slot"?: string;
}

/**
 * Forced colors replaces the muted selected background with Canvas, so a selected row takes the
 * system "selected" pairing (as the active pagination link and segmented tab do), on hover too.
 *
 * *Amended (Task 6 fix round 1, see design-system-v2 spec §4)*: `forced-color-adjust: none`
 * disables Chromium's forced-colors text backplate, which otherwise paints Canvas over the
 * `Highlight` fill and hides `HighlightText` on the row's own text and its cells' inherited text
 * colour alike (the row is the element with the Highlight/HighlightText pair; cells have no colour
 * of their own, so they inherit it and are covered by the same rule on the row).
 */
const selectedForcedColorsClasses =
  "forced-colors:aria-selected:bg-[Highlight] forced-colors:aria-selected:text-[HighlightText] forced-colors:aria-selected:forced-color-adjust-none forced-colors:data-[state=selected]:bg-[Highlight] forced-colors:data-[state=selected]:text-[HighlightText] forced-colors:data-[state=selected]:forced-color-adjust-none";

/** `<tr>`. Hover highlight, plus a selected look via `data-state="selected"` or `aria-selected`. */
export function TableRow({
  className,
  "data-slot": dataSlot = "table-row",
  ...props
}: TableRowProps) {
  return (
    <tr
      {...props}
      data-slot={dataSlot}
      className={cn(
        "border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted aria-selected:bg-muted",
        selectedForcedColorsClasses,
        className,
      )}
    />
  );
}

export interface TableHeadProps extends ComponentProps<"th"> {
  /** Sets `aria-sort`; omitted (not rendered) when left `undefined`. */
  sort?: "ascending" | "descending" | "none";
  /** @default "table-head" */
  "data-slot"?: string;
}

/** `<th>`, `scope="col"` by default (override for row headers). */
export function TableHead({
  className,
  sort,
  scope = "col",
  "data-slot": dataSlot = "table-head",
  ...props
}: TableHeadProps) {
  return (
    <th
      {...props}
      scope={scope}
      aria-sort={sort}
      data-slot={dataSlot}
      className={cn(
        "h-10 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap",
        className,
      )}
    />
  );
}

export interface TableCellProps extends ComponentProps<"td"> {
  /** @default "table-cell" */
  "data-slot"?: string;
}

/** `<td>`. */
export function TableCell({
  className,
  "data-slot": dataSlot = "table-cell",
  ...props
}: TableCellProps) {
  return (
    <td {...props} data-slot={dataSlot} className={cn("px-3 py-2.5 align-middle", className)} />
  );
}

export type TableCaptionProps = ComponentProps<"caption">;

/** `<caption>`, placed below the table by `caption-bottom` on `Table`. */
export function TableCaption({ className, ...props }: TableCaptionProps) {
  return (
    <caption
      {...props}
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
    />
  );
}

function ArrowUpIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}

function ArrowUpDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="m21 16-4 4-4-4" />
      <path d="M17 20V4" />
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
    </svg>
  );
}

export interface TableSortButtonProps extends ComponentProps<"button"> {
  /** Picks the trailing icon (arrow-up / arrow-down / arrow-up-down). @default "none" */
  direction?: "ascending" | "descending" | "none";
  /** @default "table-sort-button" */
  "data-slot"?: string;
}

const tableSortButtonClasses =
  "-ml-2 inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 hover:bg-muted hover:text-foreground outline-none outline-offset-2 outline-ring focus-visible:outline-2 focus-visible:outline-solid";

/**
 * A button for a `TableHead`'s sortable column label. No hooks: `onClick` and the current
 * `direction` (paired with `aria-sort` on the surrounding `TableHead`) are the caller's.
 */
export function TableSortButton({
  direction = "none",
  className,
  type = "button",
  children,
  "data-slot": dataSlot = "table-sort-button",
  ...props
}: TableSortButtonProps) {
  return (
    <button
      {...props}
      type={type}
      data-slot={dataSlot}
      className={cn(tableSortButtonClasses, className)}
    >
      {children}
      {direction === "ascending" ? (
        <ArrowUpIcon />
      ) : direction === "descending" ? (
        <ArrowDownIcon />
      ) : (
        <ArrowUpDownIcon />
      )}
    </button>
  );
}
