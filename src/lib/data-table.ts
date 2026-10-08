/*
 * The data-table engine (spec Phase K §6.1): sorting, paging, row selection and column
 * visibility as pure functions over plain arrays, shared by `useDataTable` and a server that
 * sorts and pages itself. Server-safe: no `window`, no React at runtime.
 */
import type { ReactNode } from "react";

/** One column of a `useDataTable` / `DataTable`. */
export interface DataTableColumn<TData> {
  /** Unique within the table; the key of sorting and visibility state. */
  id: string;
  header: ReactNode;
  /** Plain text for menus and announcements. @default `header` when it is a string, else `id` */
  label?: string;
  /** The value sorted by (and shown, unless `cell` is given). */
  accessor?: (row: TData) => unknown;
  /** The cell's content. @default String(accessor(row) ?? "") */
  cell?: (row: TData) => ReactNode;
  /** @default accessor !== undefined || compare !== undefined */
  sortable?: boolean;
  /** Ascending order of two rows; used instead of `defaultCompare` on the accessor's values. */
  compare?: (a: TData, b: TData) => number;
  /** Whether the columns menu can hide it. @default true */
  hideable?: boolean;
  /** @default "start" */
  align?: "start" | "end";
  /** Renders the cell as `th scope="row"`. */
  rowHeader?: boolean;
  headerClassName?: string;
  cellClassName?: string;
}

export type SortDirection = "ascending" | "descending";
/** The sort keys in priority order: index 0 is the primary sort. */
export type SortingState = { id: string; desc: boolean }[];
export interface PaginationState {
  pageIndex: number;
  pageSize: number;
}
/** Column id → visible. A missing id is visible. */
export type ColumnVisibility = Record<string, boolean>;
export type SelectionMode = "none" | "single" | "multiple";
/** How much of the current page is selected (the header checkbox's state). */
export type PageSelection = "all" | "some" | "none";

/**
 * The sort after a click on a column's header. Plain: ascending → descending → none, and any
 * other column replaces the sort. `multi` (Shift): ascending → descending → removed in place, a
 * new column is appended ascending, and past `maxMultiSort` the lowest-priority entry goes.
 */
export function nextSorting(
  sorting: SortingState,
  columnId: string,
  { multi = false, maxMultiSort = 3 }: { multi?: boolean; maxMultiSort?: number } = {},
): SortingState {
  const current = sorting.find((entry) => entry.id === columnId);
  if (!multi) {
    if (sorting.length === 1 && current) return current.desc ? [] : [{ id: columnId, desc: true }];
    return [{ id: columnId, desc: false }];
  }
  if (current) {
    return current.desc
      ? sorting.filter((entry) => entry !== current)
      : sorting.map((entry) => (entry === current ? { id: columnId, desc: true } : entry));
  }
  const keep = Math.max(0, Math.floor(maxMultiSort) - 1);
  return [...sorting.slice(0, keep), { id: columnId, desc: false }];
}

let fallbackCollator: Intl.Collator | undefined;
const createCollator = (locale?: string) =>
  new Intl.Collator(locale, { numeric: true, sensitivity: "base" });

/**
 * Ascending order of two non-null values: finite numbers by value, `Date`s by time, booleans
 * `false` first, anything else by `collator` on the string forms.
 * @param collator @default new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
 */
export function defaultCompare(a: unknown, b: unknown, collator?: Intl.Collator): number {
  if (typeof a === "number" && typeof b === "number" && Number.isFinite(a) && Number.isFinite(b)) {
    return a - b;
  }
  if (a instanceof Date && b instanceof Date) {
    const difference = a.getTime() - b.getTime();
    if (!Number.isNaN(difference)) return difference;
  }
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  fallbackCollator ??= createCollator();
  return (collator ?? fallbackCollator).compare(String(a), String(b));
}

const isSortable = <TData>(column: DataTableColumn<TData>) =>
  (column.sortable ?? true) && (column.accessor !== undefined || column.compare !== undefined);

/**
 * The rows sorted by each `sorting` entry in turn: a column's `compare`, else `defaultCompare` on
 * its accessor's values, with `null` / `undefined` values last in both directions. Stable; an
 * unknown or non-sortable id is skipped. Returns a new array.
 * @param options.collator @default new Intl.Collator(locale, { numeric: true, sensitivity: "base" })
 */
export function sortRows<TData>(
  rows: readonly TData[],
  sorting: SortingState,
  columns: readonly DataTableColumn<TData>[],
  { collator, locale }: { collator?: Intl.Collator; locale?: string } = {},
): TData[] {
  const keys = sorting.flatMap((entry) => {
    const column = columns.find((candidate) => candidate.id === entry.id);
    return column && isSortable(column) ? [{ column, sign: entry.desc ? -1 : 1 }] : [];
  });
  const copy = [...rows];
  if (keys.length === 0) return copy;
  const resolved = collator ?? createCollator(locale);
  return copy.sort((a, b) => {
    for (const { column, sign } of keys) {
      let result: number;
      if (column.compare) {
        result = sign * column.compare(a, b);
      } else {
        const accessor = column.accessor as (row: TData) => unknown;
        const valueA = accessor(a);
        const valueB = accessor(b);
        const missingA = valueA === null || valueA === undefined;
        const missingB = valueB === null || valueB === undefined;
        // Missing values sort last whatever the direction.
        if (missingA || missingB) result = Number(missingA) - Number(missingB);
        else result = sign * defaultCompare(valueA, valueB, resolved);
      }
      if (result !== 0) return result;
    }
    return 0;
  });
}

/** The number of pages: at least 1, also for no rows or a page size that is not positive. */
export function getPageCount(total: number, pageSize: number): number {
  if (!(pageSize > 0)) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** A page index on an existing page: 0 … `pageCount - 1`. */
export function clampPageIndex(pageIndex: number, pageCount: number): number {
  const index = Number.isFinite(pageIndex) ? Math.floor(pageIndex) : 0;
  return Math.min(Math.max(0, index), Math.max(0, pageCount - 1));
}

/** The rows of one page (empty past the end: clamp the index first). */
export function paginateRows<TData>(rows: readonly TData[], pagination: PaginationState): TData[] {
  const start = pagination.pageIndex * pagination.pageSize;
  return rows.slice(start, start + pagination.pageSize);
}

/** The 1-based rows a page shows ("Showing 6–10 of 12"); `{ from: 0, to: 0 }` for none. */
export function getRowRange(
  pagination: PaginationState,
  total: number,
): { from: number; to: number } {
  const start = pagination.pageIndex * pagination.pageSize;
  if (total <= 0 || start >= total) return { from: 0, to: 0 };
  return { from: start + 1, to: Math.min(total, start + pagination.pageSize) };
}

/**
 * Toggles a row: `single` → `[id]`, or `[]` when it was selected; `multiple` → added or removed
 * (order kept); `none` → the same selection.
 */
export function toggleRowSelection(
  selection: readonly string[],
  id: string,
  mode: SelectionMode,
): string[] {
  if (mode === "single") return selection.includes(id) ? [] : [id];
  if (mode === "multiple") {
    return selection.includes(id) ? selection.filter((other) => other !== id) : [...selection, id];
  }
  return selection as string[];
}

/** `"all"` when every id of a non-empty page is selected, `"some"`, or `"none"`. */
export function getPageSelection(
  selection: readonly string[],
  pageIds: readonly string[],
): PageSelection {
  if (pageIds.length === 0) return "none";
  const selected = new Set(selection);
  const count = pageIds.filter((id) => selected.has(id)).length;
  if (count === pageIds.length) return "all";
  return count > 0 ? "some" : "none";
}

/**
 * The header checkbox: a fully selected page is deselected; otherwise its missing ids are added.
 * Other pages' ids are kept. Returns the same selection when nothing changes.
 */
export function togglePageSelection(
  selection: readonly string[],
  pageIds: readonly string[],
): string[] {
  if (getPageSelection(selection, pageIds) === "all") {
    const page = new Set(pageIds);
    return selection.filter((id) => !page.has(id));
  }
  const selected = new Set(selection);
  const missing = pageIds.filter((id) => !selected.has(id));
  return missing.length === 0 ? (selection as string[]) : [...selection, ...missing];
}

/** The columns whose visibility is not `false`, in order. */
export function getVisibleColumns<TData>(
  columns: readonly DataTableColumn<TData>[],
  visibility: ColumnVisibility,
): DataTableColumn<TData>[] {
  return columns.filter((column) => visibility[column.id] !== false);
}

/**
 * Shows a hidden column or hides a visible one. Refuses (returns the same object) to hide the
 * last visible column or a column with `hideable: false`, and ignores an unknown id.
 */
export function toggleColumnVisibility<TData>(
  visibility: ColumnVisibility,
  id: string,
  columns: readonly DataTableColumn<TData>[],
): ColumnVisibility {
  const column = columns.find((candidate) => candidate.id === id);
  if (!column) return visibility;
  if (visibility[id] === false) return { ...visibility, [id]: true };
  if (column.hideable === false || getVisibleColumns(columns, visibility).length <= 1) {
    return visibility;
  }
  return { ...visibility, [id]: false };
}
