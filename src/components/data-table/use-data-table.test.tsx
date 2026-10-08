import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";
import type { DataTableColumn, PaginationState, SortingState } from "../../lib/data-table";
import { type UseDataTableOptions, useDataTable } from "./use-data-table";

interface Event {
  id: string;
  title: string;
  attendees: number;
}

/** e1 … e12, titles "Event 12" … "Event 1" (reverse), attendees 1 … 12. */
const events: Event[] = Array.from({ length: 12 }, (_, i) => ({
  id: `e${i + 1}`,
  title: `Event ${12 - i}`,
  attendees: i + 1,
}));

const columns: DataTableColumn<Event>[] = [
  { id: "title", header: "Title", accessor: (row) => row.title, rowHeader: true },
  { id: "attendees", header: "Attendees", accessor: (row) => row.attendees, align: "end" },
  { id: "actions", header: "Actions", hideable: false },
];

const getRowId = (row: Event) => row.id;
const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

type Options = Partial<UseDataTableOptions<Event>>;

async function setup(options: Options = {}) {
  return renderHook((props?: Options) => useDataTable<Event>({ data: events, columns, ...props }), {
    initialProps: options,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDataTable: defaults", () => {
  it("shows the first page of 10 in data order", async () => {
    const { result } = await setup();
    const table = result.current;
    expect(table.columns).toBe(columns);
    expect(table.visibleColumns.map((column) => column.id)).toEqual([
      "title",
      "attendees",
      "actions",
    ]);
    expect(ids(table.rows)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    expect(table.rows[0]).toEqual({
      id: "0",
      original: events[0],
      index: 0,
      selected: false,
      selectable: false,
    });
    expect(table.rowCount).toBe(12);
    expect(table.pageCount).toBe(2);
    expect(table.pageIds).toEqual(ids(table.rows));
    expect(table.state).toEqual({
      sorting: [],
      rowSelection: [],
      pagination: { pageIndex: 0, pageSize: 10 },
      columnVisibility: {},
    });
    expect(table.selectionMode).toBe("none");
    expect(table.pageSelection).toBe("none");
    expect(table.primarySortId).toBeNull();
    expect(table.canPreviousPage).toBe(false);
    expect(table.canNextPage).toBe(true);
    expect(table.locale).toBeUndefined();
  });

  it("getRowId names the rows; index is the position in data", async () => {
    const { result } = await setup({ getRowId, defaultSorting: [{ id: "title", desc: false }] });
    const first = result.current.rows[0];
    // "Event 1" is the last event.
    expect(first?.id).toBe("e12");
    expect(first?.index).toBe(11);
    expect(first?.original).toBe(events[11]);
  });
});

describe("useDataTable: sorting", () => {
  it("uncontrolled: toggleSort cycles ascending → descending → none and reports each", async () => {
    const onSortingChange = vi.fn();
    const { result, act } = await setup({ getRowId, onSortingChange });
    await act(() => result.current.toggleSort("attendees"));
    expect(result.current.state.sorting).toEqual([{ id: "attendees", desc: false }]);
    expect(result.current.getSort("attendees")).toEqual({ direction: "ascending", priority: 1 });
    expect(result.current.primarySortId).toBe("attendees");
    expect(ids(result.current.rows).slice(0, 3)).toEqual(["e1", "e2", "e3"]);
    await act(() => result.current.toggleSort("attendees"));
    expect(result.current.getSort("attendees")).toEqual({ direction: "descending", priority: 1 });
    expect(ids(result.current.rows).slice(0, 3)).toEqual(["e12", "e11", "e10"]);
    await act(() => result.current.toggleSort("attendees"));
    expect(result.current.state.sorting).toEqual([]);
    expect(result.current.getSort("attendees")).toEqual({ direction: null, priority: null });
    expect(result.current.primarySortId).toBeNull();
    expect(onSortingChange.mock.calls.map(([sorting]) => sorting)).toEqual([
      [{ id: "attendees", desc: false }],
      [{ id: "attendees", desc: true }],
      [],
    ]);
  });

  it("sorts strings numerically with the locale's collator", async () => {
    const { result, act } = await setup({ getRowId, locale: "en" });
    await act(() => result.current.toggleSort("title"));
    expect(result.current.rows.map((row) => row.original.title).slice(0, 3)).toEqual([
      "Event 1",
      "Event 2",
      "Event 3",
    ]);
    expect(result.current.locale).toBe("en");
  });

  it("multi-sort: Shift adds a secondary key with priority 2; maxMultiSort caps it", async () => {
    const { result, act, rerender } = await setup({ getRowId });
    await act(() => result.current.toggleSort("title"));
    await act(() => result.current.toggleSort("attendees", { multi: true }));
    expect(result.current.state.sorting).toEqual([
      { id: "title", desc: false },
      { id: "attendees", desc: false },
    ]);
    expect(result.current.getSort("attendees")).toEqual({ direction: "ascending", priority: 2 });
    expect(result.current.primarySortId).toBe("title");
    // A plain toggle replaces the multi-sort.
    await act(() => result.current.toggleSort("attendees"));
    expect(result.current.state.sorting).toEqual([{ id: "attendees", desc: false }]);
    await rerender({ getRowId, maxMultiSort: 1 });
    await act(() => result.current.toggleSort("title", { multi: true }));
    expect(result.current.state.sorting).toEqual([{ id: "title", desc: false }]);
  });

  it("enableMultiSort={false} treats a multi toggle as plain", async () => {
    const { result, act } = await setup({ enableMultiSort: false });
    await act(() => result.current.toggleSort("title"));
    await act(() => result.current.toggleSort("attendees", { multi: true }));
    expect(result.current.state.sorting).toEqual([{ id: "attendees", desc: false }]);
  });

  it("controlled: the parent's sorting shows; toggleSort only reports", async () => {
    const onSortingChange = vi.fn();
    const sorting: SortingState = [{ id: "attendees", desc: true }];
    const { result, act, rerender } = await setup({ getRowId, sorting, onSortingChange });
    expect(ids(result.current.rows)[0]).toBe("e12");
    await act(() => result.current.toggleSort("title"));
    expect(onSortingChange).toHaveBeenCalledWith([{ id: "title", desc: false }]);
    expect(result.current.state.sorting).toBe(sorting);
    await rerender({ getRowId, sorting: [{ id: "title", desc: false }], onSortingChange });
    expect(ids(result.current.rows)[0]).toBe("e12");
    expect(result.current.getSort("title").direction).toBe("ascending");
  });

  it("setSorting reports only a change; a non-sortable column is not toggled", async () => {
    const onSortingChange = vi.fn();
    const { result, act } = await setup({
      defaultSorting: [{ id: "title", desc: false }],
      onSortingChange,
    });
    await act(() => result.current.setSorting([{ id: "title", desc: false }]));
    await act(() => result.current.toggleSort("actions"));
    await act(() => result.current.toggleSort("missing"));
    expect(onSortingChange).not.toHaveBeenCalled();
    await act(() => result.current.setSorting([]));
    expect(onSortingChange).toHaveBeenCalledWith([]);
  });

  it("sorting resets the page to the first (toggleSort and setSorting)", async () => {
    const onPaginationChange = vi.fn();
    const { result, act } = await setup({
      defaultPagination: { pageIndex: 0, pageSize: 5 },
      onPaginationChange,
    });
    await act(() => result.current.setPageIndex(2));
    expect(result.current.state.pagination.pageIndex).toBe(2);
    await act(() => result.current.toggleSort("title"));
    expect(result.current.state.pagination).toEqual({ pageIndex: 0, pageSize: 5 });
    expect(onPaginationChange).toHaveBeenLastCalledWith({ pageIndex: 0, pageSize: 5 });
    await act(() => result.current.nextPage());
    await act(() => result.current.setSorting([{ id: "attendees", desc: true }]));
    expect(result.current.state.pagination.pageIndex).toBe(0);
    // Already on the first page: sorting does not report a pagination change.
    onPaginationChange.mockClear();
    await act(() => result.current.toggleSort("attendees"));
    expect(onPaginationChange).not.toHaveBeenCalled();
  });
});

describe("useDataTable: pagination", () => {
  it("nextPage / previousPage / setPageIndex move within the pages and clamp", async () => {
    const onPaginationChange = vi.fn();
    const { result, act } = await setup({
      getRowId,
      defaultPagination: { pageIndex: 0, pageSize: 5 },
      onPaginationChange,
    });
    expect(result.current.pageCount).toBe(3);
    await act(() => result.current.nextPage());
    expect(ids(result.current.rows)).toEqual(["e6", "e7", "e8", "e9", "e10"]);
    expect(result.current.canPreviousPage).toBe(true);
    await act(() => result.current.setPageIndex(99));
    expect(result.current.state.pagination.pageIndex).toBe(2);
    expect(ids(result.current.rows)).toEqual(["e11", "e12"]);
    expect(result.current.canNextPage).toBe(false);
    onPaginationChange.mockClear();
    // No-ops report nothing.
    await act(() => result.current.nextPage());
    await act(() => result.current.setPageIndex(2));
    expect(onPaginationChange).not.toHaveBeenCalled();
    await act(() => result.current.previousPage());
    expect(result.current.state.pagination.pageIndex).toBe(1);
    await act(() => result.current.setPageIndex(-3));
    expect(result.current.state.pagination.pageIndex).toBe(0);
    onPaginationChange.mockClear();
    await act(() => result.current.previousPage());
    expect(onPaginationChange).not.toHaveBeenCalled();
  });

  it("a page index past the end after data shrinks is clamped in state and rows", async () => {
    const { result, act, rerender } = await setup({
      getRowId,
      defaultPagination: { pageIndex: 0, pageSize: 5 },
    });
    await act(() => result.current.setPageIndex(2));
    expect(ids(result.current.rows)).toEqual(["e11", "e12"]);
    await rerender({
      getRowId,
      defaultPagination: { pageIndex: 0, pageSize: 5 },
      data: events.slice(0, 6),
    });
    expect(result.current.pageCount).toBe(2);
    expect(result.current.state.pagination).toEqual({ pageIndex: 1, pageSize: 5 });
    expect(ids(result.current.rows)).toEqual(["e6"]);
    expect(result.current.canNextPage).toBe(false);
    await rerender({ getRowId, data: [] });
    expect(result.current.state.pagination.pageIndex).toBe(0);
    expect(result.current.rows).toEqual([]);
    expect(result.current.pageCount).toBe(1);
  });

  it("a controlled page index past the end is clamped too", async () => {
    const { result } = await setup({ pagination: { pageIndex: 7, pageSize: 5 } });
    expect(result.current.state.pagination).toEqual({ pageIndex: 2, pageSize: 5 });
    expect(ids(result.current.rows)).toEqual(["10", "11"]);
  });

  it("setPageSize keeps the first visible row on screen", async () => {
    const { result, act } = await setup({
      getRowId,
      defaultPagination: { pageIndex: 2, pageSize: 4 },
    });
    // Page 3 of 4 rows starts at row 9 (index 8).
    expect(ids(result.current.rows)[0]).toBe("e9");
    await act(() => result.current.setPageSize(5));
    expect(result.current.state.pagination).toEqual({ pageIndex: 1, pageSize: 5 });
    expect(ids(result.current.rows)).toContain("e9");
    await act(() => result.current.setPageSize(10));
    expect(result.current.state.pagination).toEqual({ pageIndex: 0, pageSize: 10 });
    expect(ids(result.current.rows)).toContain("e6");
    await act(() => result.current.nextPage());
    await act(() => result.current.setPageSize(3));
    // Row 11 (index 10) is on page 4 of 3 rows.
    expect(result.current.state.pagination).toEqual({ pageIndex: 3, pageSize: 3 });
    expect(ids(result.current.rows)[0]).toBe("e10");
  });

  it("controlled: the parent's pagination shows; setters only report", async () => {
    const onPaginationChange = vi.fn();
    const pagination: PaginationState = { pageIndex: 1, pageSize: 5 };
    const { result, act, rerender } = await setup({ pagination, onPaginationChange });
    expect(ids(result.current.rows)).toEqual(["5", "6", "7", "8", "9"]);
    await act(() => result.current.nextPage());
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 2, pageSize: 5 });
    expect(result.current.state.pagination).toEqual(pagination);
    await rerender({ pagination: { pageIndex: 2, pageSize: 5 }, onPaginationChange });
    expect(ids(result.current.rows)).toEqual(["10", "11"]);
  });

  it("paginate={false} shows every row on one page", async () => {
    const { result } = await setup({ paginate: false });
    expect(result.current.rows).toHaveLength(12);
    expect(result.current.pageCount).toBe(1);
    expect(result.current.canNextPage).toBe(false);
  });
});

describe("useDataTable: selection", () => {
  it("multiple, uncontrolled: toggleRow, togglePage, selectAll, clearSelection", async () => {
    const onRowSelectionChange = vi.fn();
    const { result, act } = await setup({
      getRowId,
      selectionMode: "multiple",
      defaultPagination: { pageIndex: 0, pageSize: 5 },
      onRowSelectionChange,
    });
    expect(result.current.rows.every((row) => row.selectable)).toBe(true);
    await act(() => result.current.toggleRow("e2"));
    expect(result.current.state.rowSelection).toEqual(["e2"]);
    expect(result.current.rows[1]?.selected).toBe(true);
    expect(result.current.pageSelection).toBe("some");
    await act(() => result.current.togglePage());
    expect(result.current.pageSelection).toBe("all");
    expect(result.current.state.rowSelection).toEqual(["e2", "e1", "e3", "e4", "e5"]);
    await act(() => result.current.togglePage());
    expect(result.current.pageSelection).toBe("none");
    expect(result.current.state.rowSelection).toEqual([]);
    await act(() => result.current.selectAll());
    expect(result.current.state.rowSelection).toHaveLength(12);
    expect(result.current.selectedRows).toEqual(events);
    onRowSelectionChange.mockClear();
    // selectAll again is a no-op.
    await act(() => result.current.selectAll());
    expect(onRowSelectionChange).not.toHaveBeenCalled();
    await act(() => result.current.clearSelection());
    expect(result.current.state.rowSelection).toEqual([]);
    expect(onRowSelectionChange).toHaveBeenCalledTimes(1);
    await act(() => result.current.clearSelection());
    expect(onRowSelectionChange).toHaveBeenCalledTimes(1);
  });

  it("selection survives sorting and paging; selectedRows are in data order", async () => {
    const { result, act } = await setup({
      getRowId,
      selectionMode: "multiple",
      defaultPagination: { pageIndex: 0, pageSize: 5 },
    });
    await act(() => result.current.toggleRow("e4"));
    await act(() => result.current.toggleRow("e1"));
    await act(() => result.current.toggleSort("attendees"));
    await act(() => result.current.toggleSort("attendees"));
    expect(result.current.state.rowSelection).toEqual(["e4", "e1"]);
    // Descending: e12 … e8 on page 1, e4 and e1 on later pages.
    expect(result.current.pageSelection).toBe("none");
    await act(() => result.current.setPageIndex(1));
    expect(result.current.rows.filter((row) => row.selected).map((row) => row.id)).toEqual(["e4"]);
    expect(result.current.selectedRows.map((row) => row.id)).toEqual(["e1", "e4"]);
  });

  it("selectedRows ignores ids no longer in data, which stay in state", async () => {
    const { result, rerender } = await setup({
      getRowId,
      selectionMode: "multiple",
      defaultRowSelection: ["e2", "e11"],
    });
    expect(result.current.selectedRows.map((row) => row.id)).toEqual(["e2", "e11"]);
    await rerender({
      getRowId,
      selectionMode: "multiple",
      defaultRowSelection: ["e2", "e11"],
      data: events.slice(0, 5),
    });
    expect(result.current.selectedRows.map((row) => row.id)).toEqual(["e2"]);
    expect(result.current.state.rowSelection).toEqual(["e2", "e11"]);
  });

  it("isRowSelectable: those rows are not selectable and togglePage / selectAll skip them", async () => {
    const onRowSelectionChange = vi.fn();
    const { result, act } = await setup({
      getRowId,
      selectionMode: "multiple",
      defaultPagination: { pageIndex: 0, pageSize: 4 },
      isRowSelectable: (row) => row.attendees % 2 === 1,
      onRowSelectionChange,
    });
    expect(result.current.rows.map((row) => row.selectable)).toEqual([true, false, true, false]);
    await act(() => result.current.toggleRow("e2"));
    expect(onRowSelectionChange).not.toHaveBeenCalled();
    await act(() => result.current.togglePage());
    expect(result.current.state.rowSelection).toEqual(["e1", "e3"]);
    // Every selectable row of the page is selected: the page counts as all.
    expect(result.current.pageSelection).toBe("all");
    await act(() => result.current.togglePage());
    expect(result.current.state.rowSelection).toEqual([]);
    await act(() => result.current.selectAll());
    expect(result.current.state.rowSelection).toEqual(["e1", "e3", "e5", "e7", "e9", "e11"]);
  });

  it("a page with no selectable rows is 'none' and togglePage does nothing", async () => {
    const onRowSelectionChange = vi.fn();
    const { result, act } = await setup({
      getRowId,
      selectionMode: "multiple",
      isRowSelectable: () => false,
      onRowSelectionChange,
    });
    expect(result.current.pageSelection).toBe("none");
    await act(() => result.current.togglePage());
    await act(() => result.current.selectAll());
    expect(onRowSelectionChange).not.toHaveBeenCalled();
  });

  it("single: toggleRow replaces the selection; togglePage and selectAll do nothing", async () => {
    const onRowSelectionChange = vi.fn();
    const { result, act } = await setup({
      getRowId,
      selectionMode: "single",
      onRowSelectionChange,
    });
    await act(() => result.current.toggleRow("e1"));
    await act(() => result.current.toggleRow("e3"));
    expect(result.current.state.rowSelection).toEqual(["e3"]);
    expect(result.current.selectedRows).toEqual([events[2]]);
    await act(() => result.current.togglePage());
    await act(() => result.current.selectAll());
    expect(onRowSelectionChange).toHaveBeenCalledTimes(2);
    await act(() => result.current.toggleRow("e3"));
    expect(result.current.state.rowSelection).toEqual([]);
  });

  it("none: rows are not selectable and toggleRow does nothing", async () => {
    const onRowSelectionChange = vi.fn();
    const { result, act } = await setup({ getRowId, onRowSelectionChange });
    await act(() => result.current.toggleRow("e1"));
    await act(() => result.current.togglePage());
    await act(() => result.current.selectAll());
    expect(onRowSelectionChange).not.toHaveBeenCalled();
    expect(result.current.rows.some((row) => row.selectable)).toBe(false);
  });

  it("controlled: the parent's selection shows; toggles only report", async () => {
    const onRowSelectionChange = vi.fn();
    const { result, act, rerender } = await setup({
      getRowId,
      selectionMode: "multiple",
      rowSelection: ["e1"],
      onRowSelectionChange,
    });
    expect(result.current.rows[0]?.selected).toBe(true);
    await act(() => result.current.toggleRow("e2"));
    expect(onRowSelectionChange).toHaveBeenCalledWith(["e1", "e2"]);
    expect(result.current.state.rowSelection).toEqual(["e1"]);
    await rerender({
      getRowId,
      selectionMode: "multiple",
      rowSelection: ["e1", "e2"],
      onRowSelectionChange,
    });
    expect(result.current.rows[1]?.selected).toBe(true);
  });

  it("warns in development when selection is on without getRowId", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rerender } = await setup({ selectionMode: "multiple" });
    await rerender({ selectionMode: "multiple", data: events.slice(0, 3) });
    const calls = warn.mock.calls.filter(([message]) => String(message).includes("getRowId"));
    expect(calls).toHaveLength(1);
    warn.mockClear();
    await setup({ selectionMode: "single", getRowId });
    await setup({});
    expect(warn.mock.calls.filter(([message]) => String(message).includes("getRowId"))).toEqual([]);
  });
});

describe("useDataTable: column visibility", () => {
  it("uncontrolled: toggleColumn hides and shows; canHideColumn guards", async () => {
    const onColumnVisibilityChange = vi.fn();
    const { result, act } = await setup({ onColumnVisibilityChange });
    expect(result.current.canHideColumn("attendees")).toBe(true);
    expect(result.current.canHideColumn("actions")).toBe(false);
    expect(result.current.canHideColumn("missing")).toBe(false);
    await act(() => result.current.toggleColumn("attendees"));
    expect(result.current.state.columnVisibility).toEqual({ attendees: false });
    expect(result.current.visibleColumns.map((column) => column.id)).toEqual(["title", "actions"]);
    // A hidden column can always be shown again.
    expect(result.current.canHideColumn("attendees")).toBe(true);
    await act(() => result.current.toggleColumn("actions"));
    expect(onColumnVisibilityChange).toHaveBeenCalledTimes(1);
    await act(() => result.current.toggleColumn("attendees"));
    expect(result.current.state.columnVisibility).toEqual({ attendees: true });
  });

  it("the last visible column cannot be hidden", async () => {
    const onColumnVisibilityChange = vi.fn();
    const { result, act } = await setup({
      columns: columns.slice(0, 2),
      defaultColumnVisibility: { title: false },
      onColumnVisibilityChange,
    });
    expect(result.current.canHideColumn("attendees")).toBe(false);
    await act(() => result.current.toggleColumn("attendees"));
    expect(onColumnVisibilityChange).not.toHaveBeenCalled();
    expect(result.current.visibleColumns.map((column) => column.id)).toEqual(["attendees"]);
  });

  it("controlled: the parent's visibility shows; toggles only report", async () => {
    const onColumnVisibilityChange = vi.fn();
    const { result, act, rerender } = await setup({
      columnVisibility: { title: false },
      onColumnVisibilityChange,
    });
    expect(result.current.visibleColumns.map((column) => column.id)).toEqual([
      "attendees",
      "actions",
    ]);
    await act(() => result.current.toggleColumn("title"));
    expect(onColumnVisibilityChange).toHaveBeenCalledWith({ title: true });
    expect(result.current.state.columnVisibility).toEqual({ title: false });
    await rerender({ columnVisibility: {}, onColumnVisibilityChange });
    expect(result.current.visibleColumns).toHaveLength(3);
  });
});

describe("useDataTable: manual (server-side)", () => {
  it("does not sort or slice; rowCount drives the pages; changes only update state", async () => {
    const onSortingChange = vi.fn();
    const page = events.slice(0, 5);
    const { result, act } = await setup({
      getRowId,
      data: page,
      manual: true,
      rowCount: 36,
      defaultPagination: { pageIndex: 0, pageSize: 5 },
      onSortingChange,
    });
    expect(ids(result.current.rows)).toEqual(["e1", "e2", "e3", "e4", "e5"]);
    expect(result.current.rowCount).toBe(36);
    expect(result.current.pageCount).toBe(8);
    await act(() => result.current.toggleSort("attendees"));
    await act(() => result.current.toggleSort("attendees"));
    expect(onSortingChange).toHaveBeenLastCalledWith([{ id: "attendees", desc: true }]);
    expect(ids(result.current.rows)).toEqual(["e1", "e2", "e3", "e4", "e5"]);
    await act(() => result.current.setPageIndex(7));
    expect(result.current.state.pagination.pageIndex).toBe(7);
    expect(ids(result.current.rows)).toEqual(["e1", "e2", "e3", "e4", "e5"]);
    await act(() => result.current.setPageIndex(9));
    expect(result.current.state.pagination.pageIndex).toBe(7);
  });

  it("without rowCount the data length counts", async () => {
    const { result } = await setup({ manual: true, data: events.slice(0, 3) });
    expect(result.current.rowCount).toBe(3);
    expect(result.current.pageCount).toBe(1);
  });
});

describe("useDataTable: labels and memoisation", () => {
  it("getRowLabel: the option, else the first rowHeader column's text, else the id", async () => {
    const { result, rerender } = await setup({ getRowId });
    const row = result.current.rows[0];
    if (!row) throw new Error("no row");
    expect(result.current.getRowLabel(row)).toBe("Event 12");
    await rerender({ getRowId, getRowLabel: (event) => `#${event.id}` });
    expect(result.current.getRowLabel(row)).toBe("#e1");
    await rerender({ getRowId, columns: columns.slice(1) });
    expect(result.current.getRowLabel(row)).toBe("e1");
  });

  it("does not re-sort on a re-render with the same inputs", async () => {
    const compare = vi.fn((a: Event, b: Event) => a.attendees - b.attendees);
    const spied: DataTableColumn<Event>[] = [{ id: "attendees", header: "Attendees", compare }];
    const options: Options = {
      columns: spied,
      getRowId,
      defaultSorting: [{ id: "attendees", desc: true }],
    };
    const { result, act, rerender } = await setup(options);
    expect(compare).toHaveBeenCalled();
    expect(ids(result.current.rows)[0]).toBe("e12");
    compare.mockClear();
    await rerender({ ...options, getRowLabel: () => "unrelated" });
    await act(() => result.current.nextPage());
    await act(() => result.current.toggleColumn("attendees"));
    expect(compare).not.toHaveBeenCalled();
    await act(() => result.current.setSorting([{ id: "attendees", desc: false }]));
    expect(compare).toHaveBeenCalled();
    expect(ids(result.current.rows)[0]).toBe("e1");
  });
});
