"use client";

import { type ComponentProps, type ReactNode, useEffect, useId, useRef } from "react";
import { cn } from "../../lib/cn";
import { type DataTableColumn, getRowRange, type SortDirection } from "../../lib/data-table";
import { Columns3Icon } from "../../lib/icons";
import { useStatusMessage } from "../../lib/use-status-message";
import { buttonVariants } from "../button/button-variants";
import { Checkbox } from "../checkbox";
import { Menu, MenuCheckboxItem, MenuContent, MenuTrigger } from "../menu";
import {
  getPaginationRange,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";
import { Skeleton } from "../skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  type TableProps,
  TableRow,
  TableSortButton,
} from "../table";
import {
  dataTableEmptyCell,
  dataTableEndAligned,
  dataTableEndSortButton,
  dataTablePageSize,
  dataTablePagination,
  dataTablePaginationControls,
  dataTableRadio,
  dataTableRange,
  dataTableRow,
  dataTableRowHeader,
  dataTableSelectCell,
  dataTableSelectHead,
  dataTableSelectSkeleton,
  dataTableSkeleton,
  dataTableSortPriority,
} from "./data-table-classes";
import type { DataTableInstance, DataTableRow } from "./use-data-table";

/** A column's plain-text name: `label`, else a string `header`, else its `id`. */
const columnLabel = <TData,>(column: DataTableColumn<TData>) =>
  column.label ?? (typeof column.header === "string" ? column.header : column.id);

const cellContent = <TData,>(column: DataTableColumn<TData>, row: TData): ReactNode =>
  column.cell ? column.cell(row) : String(column.accessor?.(row) ?? "");

const defaultSelectRowLabel = (label: string) => `Select ${label}`;
const defaultSortStateLabel = (direction: SortDirection, priority: number, count: number) =>
  `sorted ${direction}${count > 1 ? `, ${priority} of ${count}` : ""}`;
const defaultSortAnnouncement = (label: string, direction: SortDirection | null, count: number) =>
  direction
    ? `Sorted by ${label}, ${direction}`
    : count > 0
      ? `Not sorted by ${label}`
      : "Sorting cleared";

export interface DataTableProps<TData> extends Omit<TableProps, "children"> {
  /** The `useDataTable` instance to render. */
  table: DataTableInstance<TData>;
  /** A visible `TableCaption` naming the table; or name it with `aria-label` / `aria-labelledby`. */
  caption?: ReactNode;
  /** Shows skeleton rows (`aria-busy` on the table); the header and a pager stay interactive. */
  loading?: boolean;
  /** @default min(pageSize, 5) */
  loadingRows?: number;
  /** The content of the one row shown when the page has no rows. @default "No results." */
  empty?: ReactNode;
  /** The header checkbox's name. @default "Select all rows on this page" */
  selectAllLabel?: string;
  /** The single-selection column's visually hidden header. @default "Select" */
  selectColumnLabel?: string;
  /** A row checkbox's (or radio's) name from the row's label. @default (label) => `Select ${label}` */
  selectRowLabel?: (label: string) => string;
  /**
   * A sorted column's visually hidden state in its sort button.
   * @default "sorted ascending" / "sorted descending", plus `, ${priority} of ${count}` when `count > 1`
   */
  sortStateLabel?: (direction: SortDirection, priority: number, count: number) => string;
  /**
   * The status announcement after a sort button changes the sort; `count` is the number of sorted
   * columns after it. @default `Sorted by ${label}, ${direction}`; for a removed column
   * `Not sorted by ${label}`, or "Sorting cleared" when nothing is sorted
   */
  sortAnnouncement?: (label: string, direction: SortDirection | null, count: number) => string;
  /** The table's description while Shift adds sort columns. @default "Shift-click to sort by more than one column" */
  multiSortHint?: string;
  /** Extra props for a row's `tr` (merged first: the row keeps its own slot and state). */
  getRowProps?: (
    row: DataTableRow<TData>,
  ) => ComponentProps<"tr"> & { [key: `data-${string}`]: string | undefined };
}

/**
 * Renders a `useDataTable` instance as a `Table`: sortable headers (`aria-sort` on the primary sort
 * column; Shift+click, Shift+Enter or Shift+Space adds a column), selection checkboxes (or native
 * radios for single selection), the current page's rows, and the empty and loading states. Sort
 * changes are announced in a visually hidden status region.
 */
export function DataTable<TData>({
  table,
  caption,
  loading = false,
  loadingRows,
  empty = "No results.",
  selectAllLabel = "Select all rows on this page",
  selectColumnLabel = "Select",
  selectRowLabel = defaultSelectRowLabel,
  sortStateLabel = defaultSortStateLabel,
  sortAnnouncement = defaultSortAnnouncement,
  multiSortHint = "Shift-click to sort by more than one column",
  getRowProps,
  "aria-describedby": ariaDescribedBy,
  ...props
}: DataTableProps<TData>) {
  const id = useId();
  const hintId = `${id}-hint`;
  const radioName = `${id}-select`;
  const [sortMessage, announceSort] = useStatusMessage();
  const pendingSort = useRef<string | null>(null);
  const { visibleColumns, selectionMode, rows } = table;
  const { sorting, pagination } = table.state;

  // biome-ignore lint/correctness/useExhaustiveDependencies: speaks once per sort change made by a sort button, after its render.
  useEffect(() => {
    const columnId = pendingSort.current;
    if (columnId === null) return;
    pendingSort.current = null;
    const column = table.columns.find((candidate) => candidate.id === columnId);
    if (!column) return;
    announceSort(
      sortAnnouncement(columnLabel(column), table.getSort(columnId).direction, sorting.length),
    );
  }, [sorting]);

  const sort = (columnId: string, multi: boolean) => {
    pendingSort.current = columnId;
    table.toggleSort(columnId, { multi });
  };

  const showHint =
    table.enableMultiSort && table.columns.some((column) => table.canSort(column.id));
  const describedBy =
    [ariaDescribedBy, showHint ? hintId : undefined].filter(Boolean).join(" ") || undefined;
  const selecting = selectionMode !== "none";
  const columnCount = visibleColumns.length + (selecting ? 1 : 0);
  const skeletonCount = loadingRows ?? Math.min(pagination.pageSize, 5);
  const noSelectableRows = loading || rows.every((row) => !row.selectable);

  return (
    <>
      <Table
        {...props}
        data-slot="data-table"
        aria-busy={loading || undefined}
        aria-describedby={describedBy}
      >
        {caption !== undefined && caption !== null && <TableCaption>{caption}</TableCaption>}
        <TableHeader>
          <TableRow>
            {selecting && (
              <TableHead data-slot="data-table-select-head" className={dataTableSelectHead}>
                {selectionMode === "multiple" ? (
                  <Checkbox
                    data-slot="data-table-select-all"
                    aria-label={selectAllLabel}
                    checked={table.pageSelection === "all"}
                    indeterminate={table.pageSelection === "some"}
                    disabled={noSelectableRows}
                    onCheckedChange={() => table.togglePage()}
                  />
                ) : (
                  <span className="sr-only">{selectColumnLabel}</span>
                )}
              </TableHead>
            )}
            {visibleColumns.map((column) => {
              const { direction, priority } = table.getSort(column.id);
              const end = column.align === "end";
              return (
                <TableHead
                  key={column.id}
                  data-slot="data-table-head"
                  sort={direction && table.primarySortId === column.id ? direction : undefined}
                  className={cn(end && dataTableEndAligned, column.headerClassName)}
                >
                  {table.canSort(column.id) ? (
                    <TableSortButton
                      data-slot="data-table-sort-button"
                      direction={direction ?? "none"}
                      className={cn(end && dataTableEndSortButton)}
                      onClick={(event) => sort(column.id, event.shiftKey)}
                      onKeyDown={(event) => {
                        // Shift+Enter / Shift+Space toggle here, once: the prevented keydown
                        // suppresses the button's own click (Enter's on keydown, Space's on keyup).
                        if (event.shiftKey && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          sort(column.id, true);
                        }
                      }}
                    >
                      {column.header}
                      {priority !== null && sorting.length > 1 && (
                        <span
                          aria-hidden="true"
                          data-slot="data-table-sort-priority"
                          className={dataTableSortPriority}
                        >
                          {priority}
                        </span>
                      )}
                      {direction && priority !== null && (
                        <span className="sr-only">
                          {sortStateLabel(direction, priority, sorting.length)}
                        </span>
                      )}
                    </TableSortButton>
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: skeletonCount }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity.
              <TableRow key={index} aria-hidden="true" data-slot="data-table-loading-row">
                {selecting && (
                  <TableCell className={dataTableSelectCell}>
                    <Skeleton className={dataTableSelectSkeleton} />
                  </TableCell>
                )}
                {visibleColumns.map((column) => (
                  <TableCell key={column.id} className={column.cellClassName}>
                    <Skeleton
                      className={cn(dataTableSkeleton, column.align === "end" && "ms-auto")}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow data-slot="data-table-empty">
              <TableCell colSpan={columnCount} className={dataTableEmptyCell}>
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const label = selectRowLabel(table.getRowLabel(row));
              const rowProps = getRowProps?.(row);
              return (
                <TableRow
                  {...rowProps}
                  key={row.id}
                  data-slot="data-table-row"
                  data-state={row.selected ? "selected" : undefined}
                  className={cn(dataTableRow, rowProps?.className)}
                >
                  {selecting && (
                    <TableCell data-slot="data-table-select-cell" className={dataTableSelectCell}>
                      {selectionMode === "multiple" ? (
                        <Checkbox
                          data-slot="data-table-select-row"
                          aria-label={label}
                          checked={row.selected}
                          disabled={!row.selectable}
                          onCheckedChange={() => table.toggleRow(row.id)}
                        />
                      ) : (
                        <input
                          type="radio"
                          data-slot="data-table-select-row"
                          name={radioName}
                          aria-label={label}
                          checked={row.selected}
                          disabled={!row.selectable}
                          // Fires only when the radio becomes checked.
                          onChange={() => table.toggleRow(row.id)}
                          className={dataTableRadio}
                        />
                      )}
                    </TableCell>
                  )}
                  {visibleColumns.map((column) => {
                    const className = cn(
                      column.align === "end" && dataTableEndAligned,
                      column.cellClassName,
                    );
                    return column.rowHeader ? (
                      <th
                        key={column.id}
                        scope="row"
                        data-slot="data-table-cell"
                        className={cn(dataTableRowHeader, className)}
                      >
                        {cellContent(column, row.original)}
                      </th>
                    ) : (
                      <TableCell key={column.id} data-slot="data-table-cell" className={className}>
                        {cellContent(column, row.original)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      {showHint && (
        <span id={hintId} data-slot="data-table-sort-hint" className="sr-only">
          {multiSortHint}
        </span>
      )}
      <span role="status" data-slot="data-table-status" className="sr-only">
        {sortMessage}
      </span>
    </>
  );
}

export interface DataTableColumnsMenuProps<TData> {
  table: DataTableInstance<TData>;
  /** The trigger's text and name. @default "Columns" */
  label?: string;
  /** Classes for the trigger. */
  className?: string;
}

/**
 * An outline "Columns" button opening a Menu with a check item per hideable column; toggling one
 * shows or hides the column and keeps the menu open. The last visible column cannot be hidden.
 */
export function DataTableColumnsMenu<TData>({
  table,
  label = "Columns",
  className,
}: DataTableColumnsMenuProps<TData>) {
  return (
    <Menu>
      <MenuTrigger
        data-slot="data-table-columns-trigger"
        className={cn(
          buttonVariants({ variant: "outline", color: "neutral", size: "sm" }),
          className,
        )}
      >
        <Columns3Icon />
        {label}
      </MenuTrigger>
      <MenuContent align="end">
        {table.columns
          .filter((column) => column.hideable !== false)
          .map((column) => (
            <MenuCheckboxItem
              key={column.id}
              checked={table.state.columnVisibility[column.id] !== false}
              disabled={!table.canHideColumn(column.id)}
              onCheckedChange={() => table.toggleColumn(column.id)}
            >
              {columnLabel(column)}
            </MenuCheckboxItem>
          ))}
      </MenuContent>
    </Menu>
  );
}

const defaultRangeLabel = (from: number, to: number, total: number) =>
  total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`;
const defaultPageLabel = (page: number) => `Page ${page}`;

export interface DataTablePaginationProps<TData> extends Omit<ComponentProps<"div">, "children"> {
  table: DataTableInstance<TData>;
  /** Shows a "Rows per page" Select with these sizes. */
  pageSizeOptions?: number[];
  /** The range text. @default "Showing 1–5 of 12", or "No results" */
  rangeLabel?: (from: number, to: number, total: number) => string;
  /** The page-size Select's name. @default "Rows per page" */
  pageSizeLabel?: string;
  /** The pager landmark's name. @default "Pagination" */
  paginationLabel?: string;
  /** A page button's name. @default (page) => `Page ${page}` */
  pageLabel?: (page: number) => string;
}

/**
 * The range text ("Showing 1–5 of 12"), an optional page-size Select and a pager of `<button>`s
 * for a `useDataTable` instance. Previous / Next at the ends are `aria-disabled` and leave the Tab
 * order, keeping focus if they disable while focused. Its own actions announce the new range in a
 * visually hidden status region; a sort that resets the page does not (DataTable announces it).
 */
export function DataTablePagination<TData>({
  table,
  pageSizeOptions,
  rangeLabel = defaultRangeLabel,
  pageSizeLabel = "Rows per page",
  paginationLabel = "Pagination",
  pageLabel = defaultPageLabel,
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  const [message, announce] = useStatusMessage();
  const pending = useRef(false);
  const { pageIndex, pageSize } = table.state.pagination;
  const { from, to } = getRowRange(table.state.pagination, table.rowCount);
  const rangeText = rangeLabel(from, to, table.rowCount);

  // biome-ignore lint/correctness/useExhaustiveDependencies: speaks once per page or page-size change made here, after its render.
  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    announce(rangeText);
  }, [pageIndex, pageSize]);

  const act = (change: () => void) => {
    pending.current = true;
    change();
  };
  const page = pageIndex + 1;

  return (
    <div
      {...props}
      data-slot="data-table-pagination"
      className={cn(dataTablePagination, className)}
    >
      <p data-slot="data-table-range" className={dataTableRange}>
        {rangeText}
      </p>
      <span role="status" data-slot="data-table-pagination-status" className="sr-only">
        {message}
      </span>
      <div data-slot="data-table-pagination-controls" className={dataTablePaginationControls}>
        {pageSizeOptions && pageSizeOptions.length > 0 && (
          <Select
            value={pageSize}
            items={pageSizeOptions.map((size) => ({ value: size, label: String(size) }))}
            onValueChange={(size) => {
              if (typeof size === "number") act(() => table.setPageSize(size));
            }}
          >
            <SelectTrigger size="sm" aria-label={pageSizeLabel} className={dataTablePageSize}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Pagination aria-label={paginationLabel} className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                render={<button type="button" />}
                disabled={!table.canPreviousPage}
                onClick={() => act(table.previousPage)}
              />
            </PaginationItem>
            {getPaginationRange({ page, pageCount: table.pageCount }).map((item) =>
              typeof item === "number" ? (
                <PaginationItem key={item}>
                  <PaginationLink
                    render={<button type="button" />}
                    isActive={item === page}
                    aria-label={pageLabel(item)}
                    onClick={() => act(() => table.setPageIndex(item - 1))}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationEllipsis />
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                render={<button type="button" />}
                disabled={!table.canNextPage}
                onClick={() => act(table.nextPage)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
