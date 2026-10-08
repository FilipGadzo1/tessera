import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import {
  type DataTableColumn,
  type PaginationState,
  type SortingState,
  sortRows,
} from "../../lib/data-table";
import { Button } from "../button";
import { Label } from "../label";
import { Switch } from "../switch";
import { DataTable, DataTableColumnsMenu, DataTablePagination } from "./data-table";
import { useDataTable } from "./use-data-table";

/**
 * `useDataTable` holds the state (sorting, paging, selection, column visibility) and
 * `DataTable`, `DataTableColumnsMenu` and `DataTablePagination` render it. Click a header to
 * sort; Shift+click (or Shift+Enter / Shift+Space) adds a column to the sort.
 */
const meta = {
  title: "Components/DataTable",
  component: DataTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj;

interface Event {
  id: string;
  title: string;
  date: string;
  venue: string;
  attendees: number;
}

const events: Event[] = [
  { id: "e1", title: "Launch party", date: "2026-10-12", venue: "Main hall", attendees: 120 },
  { id: "e2", title: "Board meeting", date: "2026-10-05", venue: "Room 4", attendees: 8 },
  { id: "e3", title: "Code review", date: "2026-10-05", venue: "Room 2", attendees: 6 },
  { id: "e4", title: "Design sprint", date: "2026-10-20", venue: "Studio", attendees: 14 },
  { id: "e5", title: "Expo", date: "2026-11-02", venue: "Convention centre", attendees: 950 },
  { id: "e6", title: "Fundraiser", date: "2026-10-12", venue: "Main hall", attendees: 300 },
  { id: "e7", title: "Gala dinner", date: "2026-12-01", venue: "Grand hotel", attendees: 200 },
  { id: "e8", title: "Hackathon", date: "2026-11-15", venue: "Studio", attendees: 80 },
  { id: "e9", title: "Investor call", date: "2026-10-05", venue: "Online", attendees: 4 },
  { id: "e10", title: "Jam session", date: "2026-10-28", venue: "Studio", attendees: 25 },
  { id: "e11", title: "Kickoff", date: "2026-10-01", venue: "Main hall", attendees: 40 },
  { id: "e12", title: "Lunch & learn", date: "2026-10-20", venue: "Room 2", attendees: 30 },
];

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** `headerClassName` widths keep the columns steady between pages and while loading. */
const columns: DataTableColumn<Event>[] = [
  {
    id: "title",
    header: "Title",
    accessor: (row) => row.title,
    rowHeader: true,
    headerClassName: "w-48",
  },
  {
    id: "date",
    header: "Date",
    accessor: (row) => row.date,
    cell: (row) => dateFormat.format(new Date(row.date)),
    headerClassName: "w-36",
    cellClassName: "whitespace-nowrap",
  },
  { id: "venue", header: "Venue", accessor: (row) => row.venue, headerClassName: "w-44" },
  {
    id: "attendees",
    header: "Attendees",
    accessor: (row) => row.attendees,
    align: "end",
    headerClassName: "w-32",
    cellClassName: "tabular-nums",
  },
];

const getRowId = (row: Event) => row.id;

/** Sortable, 12 rows, 5 per page. */
export const Basic: Story = {
  render: function Render() {
    const table = useDataTable({
      data: events,
      columns,
      getRowId,
      defaultPagination: { pageIndex: 0, pageSize: 5 },
    });
    return (
      <div className="flex flex-col gap-4">
        <DataTable table={table} aria-label="Events" />
        <DataTablePagination table={table} />
      </div>
    );
  },
};

/**
 * Sorted by date, then title: each sorted header shows its rank, and only the primary one carries
 * `aria-sort`. Shift+click another header to add it (up to three).
 */
export const MultiSort: Story = {
  name: "Multi-sort",
  render: function Render() {
    const table = useDataTable({
      data: events,
      columns,
      getRowId,
      defaultSorting: [
        { id: "date", desc: false },
        { id: "title", desc: false },
      ],
      defaultPagination: { pageIndex: 0, pageSize: 5 },
    });
    return (
      <div className="flex flex-col gap-4">
        <DataTable table={table} aria-label="Events" />
        <DataTablePagination table={table} />
      </div>
    );
  },
};

/**
 * The header checkbox selects the current page (indeterminate while part of it is selected);
 * selection survives sorting and paging. `isRowSelectable` keeps Kickoff (already held) out.
 */
export const Selection: Story = {
  render: function Render() {
    const [data, setData] = useState(events);
    const table = useDataTable({
      data,
      columns,
      getRowId,
      selectionMode: "multiple",
      defaultRowSelection: ["e2", "e3", "e9"],
      isRowSelectable: (row) => row.id !== "e11",
      defaultPagination: { pageIndex: 0, pageSize: 5 },
    });
    const count = table.selectedRows.length;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            color="danger"
            disabled={count === 0}
            onClick={() => {
              const selected = new Set(table.state.rowSelection);
              setData((current) => current.filter((row) => !selected.has(row.id)));
              table.clearSelection();
            }}
          >
            Delete {count} selected
          </Button>
          <Button size="sm" variant="ghost" color="neutral" onClick={table.selectAll}>
            Select all {data.length}
          </Button>
        </div>
        <DataTable table={table} aria-label="Events" />
        <DataTablePagination table={table} />
      </div>
    );
  },
};

/**
 * Native radios sharing one name: Tab enters the group once and the arrow keys move the choice.
 * A radio cannot be unchecked by the user, so "Clear" calls `clearSelection()`.
 */
export const SingleSelection: Story = {
  name: "Single selection",
  render: function Render() {
    const table = useDataTable({
      data: events,
      columns,
      getRowId,
      selectionMode: "single",
      defaultRowSelection: ["e4"],
      defaultPagination: { pageIndex: 0, pageSize: 5 },
    });
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Chosen: {table.selectedRows[0]?.title ?? "none"}</span>
          <Button size="sm" variant="ghost" color="neutral" onClick={table.clearSelection}>
            Clear
          </Button>
        </div>
        <DataTable table={table} aria-label="Events" />
        <DataTablePagination table={table} />
      </div>
    );
  },
};

/** The Columns menu shows and hides columns; it keeps the last visible one. */
export const ColumnVisibility: Story = {
  name: "Column visibility",
  render: function Render() {
    const table = useDataTable({
      data: events,
      columns,
      getRowId,
      defaultColumnVisibility: { venue: false },
      defaultPagination: { pageIndex: 0, pageSize: 5 },
    });
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <DataTableColumnsMenu table={table} />
        </div>
        <DataTable table={table} aria-label="Events" />
        <DataTablePagination table={table} />
      </div>
    );
  },
};

/** A "Rows per page" Select; changing it keeps the first visible row on screen. */
export const PaginationWithPageSizes: Story = {
  name: "Pagination with page sizes",
  render: function Render() {
    const many = Array.from({ length: 48 }, (_, index) => {
      const event = events[index % events.length] as Event;
      return {
        ...event,
        id: `r${index + 1}`,
        title: `${event.title} ${Math.floor(index / 12) + 1}`,
      };
    });
    const table = useDataTable({
      data: many,
      columns,
      getRowId,
      defaultPagination: { pageIndex: 0, pageSize: 5 },
    });
    return (
      <div className="flex flex-col gap-4">
        <DataTable table={table} aria-label="Events" />
        <DataTablePagination table={table} pageSizeOptions={[5, 10, 20]} />
      </div>
    );
  },
};

/**
 * `empty` replaces "No results."; `loading` shows skeleton rows while the header and the pager
 * stay usable.
 */
export const EmptyAndLoading: Story = {
  name: "Empty and loading",
  render: function Render() {
    const [loading, setLoading] = useState(true);
    const [empty, setEmpty] = useState(false);
    const table = useDataTable({
      data: empty ? [] : events,
      columns,
      getRowId,
      selectionMode: "multiple",
      defaultPagination: { pageIndex: 0, pageSize: 5 },
    });
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <Label className="flex items-center gap-2">
            <Switch checked={loading} onCheckedChange={setLoading} />
            Loading
          </Label>
          <Label className="flex items-center gap-2">
            <Switch checked={empty} onCheckedChange={setEmpty} />
            No events
          </Label>
        </div>
        <DataTable
          table={table}
          aria-label="Events"
          loading={loading}
          empty="No events match these filters."
        />
        <DataTablePagination table={table} />
      </div>
    );
  },
};

interface Page {
  rows: Event[];
  total: number;
}

/** A story-local stand-in for a server: sorts and slices after a short delay. */
function fakeFetch(sorting: SortingState, pagination: PaginationState): Promise<Page> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const sorted = sortRows(events, sorting, columns, { locale: "en-US" });
      const start = pagination.pageIndex * pagination.pageSize;
      resolve({ rows: sorted.slice(start, start + pagination.pageSize), total: events.length });
    }, 600);
  });
}

/**
 * `manual`: the data is the server's current page. Sorting and paging only change the state, the
 * story fetches the page for it, and `loading` covers the wait.
 */
export const ServerSide: Story = {
  name: "Server-side",
  render: function Render() {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 5 });
    const [page, setPage] = useState<Page>({ rows: [], total: 0 });
    const [loading, setLoading] = useState(true);
    useEffect(() => {
      let current = true;
      setLoading(true);
      fakeFetch(sorting, pagination).then((result) => {
        if (!current) return;
        setPage(result);
        setLoading(false);
      });
      return () => {
        current = false;
      };
    }, [sorting, pagination]);
    const table = useDataTable({
      data: page.rows,
      columns,
      getRowId,
      manual: true,
      rowCount: page.total,
      sorting,
      onSortingChange: setSorting,
      pagination,
      onPaginationChange: setPagination,
    });
    return (
      <div className="flex flex-col gap-4">
        <DataTable table={table} aria-label="Events" loading={loading} />
        <DataTablePagination table={table} />
      </div>
    );
  },
};

/**
 * Under `dir="rtl"` the headers and cells start at the right, the end-aligned Attendees column
 * sits at the left, the sort icon follows each label, and the pager's chevrons point the reading
 * way.
 */
export const RTL: Story = {
  render: function Render() {
    const table = useDataTable({
      data: events,
      columns,
      getRowId,
      selectionMode: "multiple",
      defaultSorting: [{ id: "title", desc: false }],
      defaultPagination: { pageIndex: 1, pageSize: 5 },
    });
    return (
      <div dir="rtl" className="flex flex-col gap-4">
        <div className="flex justify-end">
          <DataTableColumnsMenu table={table} />
        </div>
        <DataTable table={table} aria-label="Events" />
        <DataTablePagination table={table} pageSizeOptions={[5, 10]} />
      </div>
    );
  },
};
