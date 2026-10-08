"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  type ColumnVisibility,
  clampPageIndex,
  type DataTableColumn,
  getPageCount,
  getPageSelection,
  getVisibleColumns,
  nextSorting,
  type PageSelection,
  type PaginationState,
  paginateRows,
  type SelectionMode,
  type SortDirection,
  type SortingState,
  sortRows,
  toggleColumnVisibility,
  togglePageSelection,
  toggleRowSelection,
} from "../../lib/data-table";
import { useControllableState } from "../../lib/use-controllable-state";

export interface UseDataTableOptions<TData> {
  data: readonly TData[];
  columns: readonly DataTableColumn<TData>[];
  /**
   * A stable id per row: the key of selection state. @default (row, index) => String(index)
   * (index ids do not survive server-side sorting or a refetch; selection warns without it).
   */
  getRowId?: (row: TData, index: number) => string;
  /** The row's name for its selection checkbox. @default the first `rowHeader` column's text, else the id */
  getRowLabel?: (row: TData) => string;
  /** The collator's locale for sorting text. @default the runtime's */
  locale?: string;

  sorting?: SortingState;
  /** @default [] */
  defaultSorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  /** Shift adds a column to the sort. @default true */
  enableMultiSort?: boolean;
  /** @default 3 */
  maxMultiSort?: number;

  /** @default "none" */
  selectionMode?: SelectionMode;
  /** The selected row ids. */
  rowSelection?: string[];
  /** @default [] */
  defaultRowSelection?: string[];
  onRowSelectionChange?: (rowSelection: string[]) => void;
  /** Rows it returns `false` for cannot be selected. */
  isRowSelectable?: (row: TData) => boolean;

  pagination?: PaginationState;
  /** @default { pageIndex: 0, pageSize: 10 } */
  defaultPagination?: PaginationState;
  onPaginationChange?: (pagination: PaginationState) => void;
  /** `false` shows every row on one page. @default true */
  paginate?: boolean;

  columnVisibility?: ColumnVisibility;
  /** @default {} */
  defaultColumnVisibility?: ColumnVisibility;
  onColumnVisibilityChange?: (columnVisibility: ColumnVisibility) => void;

  /**
   * Server-side: `data` is already the sorted current page. Sorting and paging change state only,
   * and `rowCount` (default `data.length`) drives the page count.
   */
  manual?: boolean;
  /** The total number of rows in `manual` mode. */
  rowCount?: number;
}

/** A row of the current page. */
export interface DataTableRow<TData> {
  id: string;
  original: TData;
  /** The row's index in `data`. */
  index: number;
  selected: boolean;
  selectable: boolean;
}

export interface DataTableInstance<TData> {
  columns: readonly DataTableColumn<TData>[];
  visibleColumns: DataTableColumn<TData>[];
  /** The current page. */
  rows: DataTableRow<TData>[];
  /** Rows after sorting, before paging (`manual`: `rowCount`). */
  rowCount: number;
  pageCount: number;
  /** The ids of the current page's rows. */
  pageIds: string[];
  /** The effective state (the page index clamped to an existing page). */
  state: {
    sorting: SortingState;
    rowSelection: string[];
    pagination: PaginationState;
    columnVisibility: ColumnVisibility;
  };

  /** A header click: plain cycles one column; `multi` adds to the sort. Resets to the first page. */
  toggleSort: (id: string, options?: { multi?: boolean }) => void;
  /** Replaces the sort. Resets to the first page. */
  setSorting: (sorting: SortingState) => void;
  /** The column's direction and 1-based priority, or `null`s when it is not sorted. */
  getSort: (id: string) => { direction: SortDirection | null; priority: number | null };
  primarySortId: string | null;

  selectionMode: SelectionMode;
  toggleRow: (id: string) => void;
  /** The header checkbox: selects the current page's selectable rows, or clears them. */
  togglePage: () => void;
  /** The current page's selectable rows: all, some or none selected. */
  pageSelection: PageSelection;
  /** Selects every selectable row of `data` (`multiple` only). */
  selectAll: () => void;
  clearSelection: () => void;
  /** The rows of `data` whose id is selected, in data order. */
  selectedRows: TData[];

  setPageIndex: (pageIndex: number) => void;
  /** Changes the page size and keeps the first visible row on screen. */
  setPageSize: (pageSize: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  canNextPage: boolean;
  canPreviousPage: boolean;

  toggleColumn: (id: string) => void;
  /** Whether `toggleColumn` would change it (a hidden column can always be shown). */
  canHideColumn: (id: string) => boolean;

  /** The row's name (the `getRowLabel` option, else the first `rowHeader` column's text, else the id). */
  getRowLabel: (row: DataTableRow<TData>) => string;
  locale: string | undefined;
}

interface Entry<TData> {
  id: string;
  original: TData;
  index: number;
}

const emptySorting: SortingState = [];
const emptySelection: string[] = [];
const emptyVisibility: ColumnVisibility = {};
const firstPage: PaginationState = { pageIndex: 0, pageSize: 10 };

const sameSorting = (a: SortingState, b: SortingState) =>
  a.length === b.length &&
  a.every((entry, i) => entry.id === b[i]?.id && entry.desc === b[i]?.desc);
const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);
const sameVisibility = (a: ColumnVisibility, b: ColumnVisibility) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

const canSort = <TData>(column: DataTableColumn<TData> | undefined) =>
  !!column && (column.sortable ?? (column.accessor !== undefined || column.compare !== undefined));

/**
 * The headless engine behind `DataTable`: sorting (multi-column with Shift), paging, row
 * selection by id and column visibility, each controlled or uncontrolled. The derived rows are
 * memoised, so a re-render with the same inputs does not re-sort. Built on the pure helpers of
 * `src/lib/data-table.ts`.
 */
export function useDataTable<TData>(options: UseDataTableOptions<TData>): DataTableInstance<TData> {
  const {
    data,
    columns,
    getRowId,
    getRowLabel: getRowLabelOption,
    locale,
    enableMultiSort = true,
    maxMultiSort = 3,
    selectionMode = "none",
    isRowSelectable,
    paginate = true,
    manual = false,
  } = options;

  const [sorting, setSortingState] = useControllableState(
    options.sorting,
    options.defaultSorting ?? emptySorting,
    options.onSortingChange,
  );
  const [rowSelection, setRowSelectionState] = useControllableState(
    options.rowSelection,
    options.defaultRowSelection ?? emptySelection,
    options.onRowSelectionChange,
  );
  const [storedPagination, setPaginationState] = useControllableState(
    options.pagination,
    options.defaultPagination ?? firstPage,
    options.onPaginationChange,
  );
  const [columnVisibility, setColumnVisibilityState] = useControllableState(
    options.columnVisibility,
    options.defaultColumnVisibility ?? emptyVisibility,
    options.onColumnVisibilityChange,
  );

  const warned = useRef(false);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      selectionMode !== "none" &&
      !getRowId &&
      !warned.current
    ) {
      warned.current = true;
      console.warn(
        "useDataTable: row selection without getRowId uses row indexes as ids, which do not survive sorting by the server or a refetch.",
      );
    }
  }, [selectionMode, getRowId]);

  const collator = useMemo(
    () => new Intl.Collator(locale, { numeric: true, sensitivity: "base" }),
    [locale],
  );

  const entries = useMemo(
    () =>
      data.map(
        (original, index): Entry<TData> => ({
          id: getRowId ? getRowId(original, index) : String(index),
          original,
          index,
        }),
      ),
    [data, getRowId],
  );

  const sortedEntries = useMemo(() => {
    if (manual || sorting.length === 0) return entries;
    // The engine sorts entries through the columns' accessors and comparators on the originals.
    const entryColumns = columns.map(
      ({ id, header, sortable, accessor, compare }): DataTableColumn<Entry<TData>> => ({
        id,
        header,
        sortable,
        accessor: accessor && ((entry) => accessor(entry.original)),
        compare: compare && ((a, b) => compare(a.original, b.original)),
      }),
    );
    return sortRows(entries, sorting, entryColumns, { collator });
  }, [entries, columns, sorting, collator, manual]);

  const rowCount = manual ? (options.rowCount ?? data.length) : sortedEntries.length;
  const { pageSize } = storedPagination;
  const pageCount = paginate ? getPageCount(rowCount, pageSize) : 1;
  const pageIndex = paginate ? clampPageIndex(storedPagination.pageIndex, pageCount) : 0;
  const pagination =
    pageIndex === storedPagination.pageIndex ? storedPagination : { pageIndex, pageSize };

  const pageEntries = useMemo(
    () =>
      manual || !paginate ? sortedEntries : paginateRows(sortedEntries, { pageIndex, pageSize }),
    [sortedEntries, manual, paginate, pageIndex, pageSize],
  );

  const selected = useMemo(() => new Set(rowSelection), [rowSelection]);
  const isSelectable = (row: TData) => selectionMode !== "none" && (isRowSelectable?.(row) ?? true);
  const rows = pageEntries.map(
    ({ id, original, index }): DataTableRow<TData> => ({
      id,
      original,
      index,
      selected: selected.has(id),
      selectable: isSelectable(original),
    }),
  );
  const pageIds = rows.map((row) => row.id);
  const selectablePageIds = rows.filter((row) => row.selectable).map((row) => row.id);
  const pageSelection = getPageSelection(rowSelection, selectablePageIds);
  const selectedRows = useMemo(
    () => entries.filter((entry) => selected.has(entry.id)).map((entry) => entry.original),
    [entries, selected],
  );

  const visibleColumns = useMemo(
    () => getVisibleColumns(columns, columnVisibility),
    [columns, columnVisibility],
  );

  const setPagination = (next: PaginationState) => {
    if (next.pageIndex === pagination.pageIndex && next.pageSize === pagination.pageSize) return;
    setPaginationState(next);
  };
  const setPageIndex = (index: number) =>
    setPagination({ pageIndex: clampPageIndex(index, pageCount), pageSize });

  const setSorting = (next: SortingState) => {
    if (sameSorting(next, sorting)) return;
    setSortingState(next);
    setPagination({ pageIndex: 0, pageSize });
  };

  const setRowSelection = (next: string[]) => {
    if (!sameIds(next, rowSelection)) setRowSelectionState(next);
  };

  return {
    columns,
    visibleColumns,
    rows,
    rowCount,
    pageCount,
    pageIds,
    state: { sorting, rowSelection, pagination, columnVisibility },

    toggleSort: (id, { multi = false } = {}) => {
      if (!canSort(columns.find((column) => column.id === id))) return;
      setSorting(nextSorting(sorting, id, { multi: multi && enableMultiSort, maxMultiSort }));
    },
    setSorting,
    getSort: (id) => {
      const index = sorting.findIndex((entry) => entry.id === id);
      const entry = sorting[index];
      if (!entry) return { direction: null, priority: null };
      return { direction: entry.desc ? "descending" : "ascending", priority: index + 1 };
    },
    primarySortId: sorting[0]?.id ?? null,

    selectionMode,
    toggleRow: (id) => {
      if (selectionMode === "none") return;
      const entry = entries.find((candidate) => candidate.id === id);
      if (entry && !isSelectable(entry.original)) return;
      setRowSelection(toggleRowSelection(rowSelection, id, selectionMode));
    },
    togglePage: () => {
      if (selectionMode !== "multiple") return;
      setRowSelection(togglePageSelection(rowSelection, selectablePageIds));
    },
    pageSelection,
    selectAll: () => {
      if (selectionMode !== "multiple") return;
      const missing = entries
        .filter((entry) => !selected.has(entry.id) && isSelectable(entry.original))
        .map((entry) => entry.id);
      if (missing.length > 0) setRowSelection([...rowSelection, ...missing]);
    },
    clearSelection: () => setRowSelection([]),
    selectedRows,

    setPageIndex,
    setPageSize: (size) => {
      if (!(size > 0)) return;
      const firstRow = pageIndex * pageSize;
      setPagination({
        pageIndex: clampPageIndex(Math.floor(firstRow / size), getPageCount(rowCount, size)),
        pageSize: size,
      });
    },
    nextPage: () => setPageIndex(pageIndex + 1),
    previousPage: () => setPageIndex(pageIndex - 1),
    canNextPage: pageIndex < pageCount - 1,
    canPreviousPage: pageIndex > 0,

    toggleColumn: (id) => {
      const next = toggleColumnVisibility(columnVisibility, id, columns);
      if (!sameVisibility(next, columnVisibility)) setColumnVisibilityState(next);
    },
    canHideColumn: (id) =>
      toggleColumnVisibility(columnVisibility, id, columns) !== columnVisibility,

    getRowLabel: (row) => {
      if (getRowLabelOption) return getRowLabelOption(row.original);
      const accessor = columns.find((column) => column.rowHeader)?.accessor;
      const text = accessor ? String(accessor(row.original) ?? "") : "";
      return text || row.id;
    },
    locale,
  };
}
