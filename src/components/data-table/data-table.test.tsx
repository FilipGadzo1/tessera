import axe from "axe-core";
import { type ReactNode, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  emulateForcedColors,
  emulateReducedMotion,
  resetEmulatedMedia,
  systemColor,
} from "../../../test/emulation";
import { auditOpenOverlay, textRect, waitForPopupSettled } from "../../../test/overlay";
import type { DataTableColumn, PaginationState, SortingState } from "../../lib/data-table";
import { Button } from "../button";
import {
  DataTable,
  DataTableColumnsMenu,
  DataTablePagination,
  type DataTablePaginationProps,
  type DataTableProps,
} from "./data-table";
import { type UseDataTableOptions, useDataTable } from "./use-data-table";

interface Event {
  id: string;
  title: string;
  start: string;
  attendees: number;
}

const events: Event[] = [
  { id: "e1", title: "Launch party", start: "2026-10-12", attendees: 120 },
  { id: "e2", title: "Board meeting", start: "2026-10-05", attendees: 8 },
  { id: "e3", title: "Code review", start: "2026-10-05", attendees: 6 },
  { id: "e4", title: "Design sprint", start: "2026-10-20", attendees: 14 },
  { id: "e5", title: "Expo", start: "2026-11-02", attendees: 950 },
  { id: "e6", title: "Fundraiser", start: "2026-10-12", attendees: 300 },
  { id: "e7", title: "Gala dinner", start: "2026-12-01", attendees: 200 },
  { id: "e8", title: "Hackathon", start: "2026-11-15", attendees: 80 },
  { id: "e9", title: "Investor call", start: "2026-10-05", attendees: 4 },
  { id: "e10", title: "Jam session", start: "2026-10-28", attendees: 25 },
  { id: "e11", title: "Kickoff", start: "2026-10-01", attendees: 40 },
  { id: "e12", title: "Lunch & learn", start: "2026-10-20", attendees: 30 },
];

const titleColumn: DataTableColumn<Event> = {
  id: "title",
  header: "Title",
  accessor: (row) => row.title,
  rowHeader: true,
};
const startColumn: DataTableColumn<Event> = {
  id: "start",
  header: "Start",
  accessor: (row) => row.start,
};
const attendeesColumn: DataTableColumn<Event> = {
  id: "attendees",
  header: "Attendees",
  accessor: (row) => row.attendees,
  align: "end",
};
const actionsColumn: DataTableColumn<Event> = {
  id: "actions",
  header: <span className="sr-only">Actions</span>,
  label: "Actions",
  hideable: false,
  cell: (row) => (
    <Button size="sm" variant="outline" color="neutral" aria-label={`Edit ${row.title}`}>
      Edit
    </Button>
  ),
};
const columns = [titleColumn, startColumn, attendeesColumn, actionsColumn];
const dataColumns = [titleColumn, startColumn, attendeesColumn];

type EventsProps = Partial<UseDataTableOptions<Event>> & {
  tableProps?: Partial<DataTableProps<Event>>;
  paginationProps?: Partial<DataTablePaginationProps<Event>>;
  menu?: boolean;
  pager?: boolean;
};

function Events({
  tableProps,
  paginationProps,
  menu = false,
  pager = true,
  ...options
}: EventsProps) {
  const table = useDataTable<Event>({
    data: events,
    columns,
    getRowId: (row) => row.id,
    defaultPagination: { pageIndex: 0, pageSize: 5 },
    ...options,
  });
  return (
    <div className="flex flex-col gap-4">
      {menu && <DataTableColumnsMenu table={table} />}
      <DataTable table={table} caption="Events" {...tableProps} />
      {pager && <DataTablePagination table={table} {...paginationProps} />}
    </div>
  );
}

const q = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  root.querySelector<T>(selector) as T;
const qa = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => [
  ...root.querySelectorAll<T>(selector),
];
const table = () => q<HTMLTableElement>('[data-slot="data-table"]');
const headRow = () => q<HTMLTableRowElement>("thead tr");
const heads = () => qa<HTMLTableCellElement>('[data-slot="data-table-head"]');
const head = (name: string) => {
  const found = heads().find((th) => th.textContent?.startsWith(name));
  if (!found) throw new Error(`no head ${name}`);
  return found;
};
const sortButton = (name: string) =>
  q<HTMLButtonElement>('[data-slot="data-table-sort-button"]', head(name));
const titles = () => qa('[data-slot="data-table-row"] th[scope="row"]').map((th) => th.textContent);
const status = () => q('[data-slot="data-table-status"]');
const range = () => q('[data-slot="data-table-range"]');
const pagerStatus = () => q('[data-slot="data-table-pagination-status"]');
const rows = () => qa<HTMLTableRowElement>('[data-slot="data-table-row"]');
const rowOf = (title: string) => {
  const found = rows().find((tr) => tr.querySelector("th")?.textContent === title);
  if (!found) throw new Error(`no row ${title}`);
  return found;
};
const previous = () => q<HTMLButtonElement>('[data-slot="pagination-previous"]');
const next = () => q<HTMLButtonElement>('[data-slot="pagination-next"]');

async function tabSequence(count: number) {
  const sequence: Element[] = [];
  for (let i = 0; i < count; i++) {
    await userEvent.tab();
    if (document.activeElement) sequence.push(document.activeElement);
  }
  return sequence;
}

function describeFocus(element: Element) {
  const slot = element.getAttribute("data-slot");
  const label = element.getAttribute("aria-label") ?? element.textContent?.trim();
  return `${slot}:${label}`;
}

async function axeClean(root: Element) {
  const results = await axe.run(root);
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  expect(
    results.incomplete.flatMap((v) =>
      v.nodes.map((node) => {
        const keys = [...node.any, ...node.all, ...node.none].map(
          (check) => check.data?.messageKey,
        );
        return `${v.id}: ${node.target} ${keys.join(",")}`;
      }),
    ),
  ).toEqual([]);
}

afterEach(async () => {
  await resetEmulatedMedia();
  vi.restoreAllMocks();
});

describe("DataTable: structure", () => {
  it("is a table named by its caption, with column headers, row headers and slots", async () => {
    const screen = await render(<Events />);
    const named = screen.getByRole("table", { name: "Events" });
    await expect.element(named).toHaveAttribute("data-slot", "data-table");
    expect(q('[data-slot="table-container"]').contains(table())).toBe(true);
    expect(heads().map((th) => th.textContent)).toEqual(["Title", "Start", "Attendees", "Actions"]);
    for (const th of heads()) expect(th.getAttribute("scope")).toBe("col");
    expect(titles()).toEqual([
      "Launch party",
      "Board meeting",
      "Code review",
      "Design sprint",
      "Expo",
    ]);
    // The default cell is the accessor's text; a custom cell renders as given.
    const first = rows()[0] as HTMLTableRowElement;
    const cells = qa('[data-slot="data-table-cell"]', first);
    expect(cells.map((cell) => cell.tagName)).toEqual(["TH", "TD", "TD", "TD"]);
    expect(cells.map((cell) => cell.textContent)).toEqual([
      "Launch party",
      "2026-10-12",
      "120",
      "Edit",
    ]);
    // The row header looks like a cell: start-aligned, normal weight.
    const rowHeader = cells[0] as HTMLElement;
    expect(getComputedStyle(rowHeader).textAlign).toBe("start");
    expect(getComputedStyle(rowHeader).fontWeight).toBe(
      getComputedStyle(cells[1] as Element).fontWeight,
    );
    // No selection column without selection; rows are not grid rows.
    expect(q('[data-slot="data-table-select-head"]')).toBeNull();
    for (const tr of rows()) expect(tr.hasAttribute("aria-selected")).toBe(false);
    // The caption names the table and renders as a TableCaption.
    expect(q('[data-slot="table-caption"]').textContent).toBe("Events");
  });

  it("names a table with aria-label instead of a caption", async () => {
    const screen = await render(
      <Events tableProps={{ caption: undefined, "aria-label": "Upcoming events" }} />,
    );
    await expect.element(screen.getByRole("table", { name: "Upcoming events" })).toBeVisible();
    expect(q('[data-slot="table-caption"]')).toBeNull();
  });

  it("the status region and the pagination status exist before any change; the range text is plain", async () => {
    await render(<Events />);
    expect(status().getAttribute("role")).toBe("status");
    expect(status().textContent).toBe("");
    expect(status().className).toContain("sr-only");
    expect(pagerStatus().getAttribute("role")).toBe("status");
    expect(pagerStatus().textContent).toBe("");
    expect(range().tagName).toBe("P");
    expect(range().textContent).toBe("Showing 1–5 of 12");
    expect(range().hasAttribute("role")).toBe(false);
    expect(range().hasAttribute("aria-live")).toBe(false);
  });

  it("getRowProps is merged into each row first; the row keeps its slot and state", async () => {
    await render(
      <Events
        selectionMode="multiple"
        defaultRowSelection={["e1"]}
        tableProps={{
          getRowProps: (row) => ({
            "data-testid": `row-${row.id}`,
            className: "custom-row",
            // A consumer's slot does not replace the row's own.
            "data-slot": "mine",
          }),
        }}
      />,
    );
    const row = q('[data-testid="row-e1"]');
    expect(row.getAttribute("data-slot")).toBe("data-table-row");
    expect(row.getAttribute("data-state")).toBe("selected");
    expect(row.classList).toContain("custom-row");
  });

  it("a column's label defaults to a string header, else its id", async () => {
    const onlyIds: DataTableColumn<Event>[] = [
      titleColumn,
      { id: "venue", header: <em>Venue</em>, accessor: (row) => row.id },
    ];
    await render(<Events columns={onlyIds} menu />);
    await userEvent.click(sortButton("Venue"));
    await expect.element(status()).toHaveTextContent("Sorted by venue, ascending");
    await userEvent.click(page.getByRole("button", { name: "Columns" }));
    await expect.element(page.getByRole("menuitemcheckbox", { name: "venue" })).toBeVisible();
    await expect.element(page.getByRole("menuitemcheckbox", { name: "Title" })).toBeVisible();
  });
});

describe("DataTable: sorting", () => {
  it("click cycles ascending → descending → none with aria-sort, reordering and announcements", async () => {
    await render(<Events />);
    expect(table().querySelectorAll("[aria-sort]")).toHaveLength(0);
    // Only sortable columns get a button.
    expect(head("Actions").querySelector("button")).toBeNull();
    await userEvent.click(sortButton("Title"));
    await expect.element(head("Title")).toHaveAttribute("aria-sort", "ascending");
    expect(titles()).toEqual([
      "Board meeting",
      "Code review",
      "Design sprint",
      "Expo",
      "Fundraiser",
    ]);
    await expect.element(status()).toHaveTextContent("Sorted by Title, ascending");
    expect(sortButton("Title").textContent).toContain("sorted ascending");
    await userEvent.click(sortButton("Title"));
    await expect.element(head("Title")).toHaveAttribute("aria-sort", "descending");
    expect(titles()[0]).toBe("Lunch & learn");
    await expect.element(status()).toHaveTextContent("Sorted by Title, descending");
    await userEvent.click(sortButton("Title"));
    await expect.poll(() => head("Title").hasAttribute("aria-sort")).toBe(false);
    expect(titles()[0]).toBe("Launch party");
    await expect.element(status()).toHaveTextContent("Sorting cleared");
    expect(sortButton("Title").querySelector(".sr-only")).toBeNull();
  });

  it("Shift+click adds a secondary sort: aria-sort on the primary only, rank text and badges", async () => {
    await render(<Events />);
    await userEvent.click(sortButton("Title"));
    await userEvent.keyboard("{Shift>}");
    await userEvent.click(sortButton("Start"));
    await userEvent.keyboard("{/Shift}");
    await expect
      .element(page.getByRole("button", { name: /^Start/ }))
      .toHaveAccessibleName(/sorted ascending, 2 of 2/);
    await expect
      .element(page.getByRole("button", { name: /^Title/ }))
      .toHaveAccessibleName(/sorted ascending, 1 of 2/);
    expect(head("Title").getAttribute("aria-sort")).toBe("ascending");
    expect(head("Start").hasAttribute("aria-sort")).toBe(false);
    expect(table().querySelectorAll("[aria-sort]")).toHaveLength(1);
    const badges = qa('[data-slot="data-table-sort-priority"]');
    expect(badges.map((badge) => badge.textContent)).toEqual(["1", "2"]);
    for (const badge of badges) expect(badge.getAttribute("aria-hidden")).toBe("true");
    await expect.element(status()).toHaveTextContent("Sorted by Start, ascending");
    // Removing the secondary leaves the primary: the announcement says what went.
    await userEvent.keyboard("{Shift>}");
    await userEvent.click(sortButton("Start"));
    await userEvent.click(sortButton("Start"));
    await userEvent.keyboard("{/Shift}");
    await expect.element(status()).toHaveTextContent("Not sorted by Start");
    expect(qa('[data-slot="data-table-sort-priority"]')).toHaveLength(0);
    expect(head("Title").getAttribute("aria-sort")).toBe("ascending");
  });

  it("Shift+Enter and Shift+Space each toggle a multi-sort exactly once", async () => {
    const onSortingChange = vi.fn();
    await render(
      <Events defaultSorting={[{ id: "title", desc: false }]} onSortingChange={onSortingChange} />,
    );
    sortButton("Start").focus();
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onSortingChange).toHaveBeenCalledTimes(1);
    expect(onSortingChange).toHaveBeenLastCalledWith([
      { id: "title", desc: false },
      { id: "start", desc: false },
    ]);
    await userEvent.keyboard("{Shift>} {/Shift}");
    expect(onSortingChange).toHaveBeenCalledTimes(2);
    expect(onSortingChange).toHaveBeenLastCalledWith([
      { id: "title", desc: false },
      { id: "start", desc: true },
    ]);
    expect(document.activeElement).toBe(sortButton("Start"));
  });

  it("plain Enter and Space sort once, replacing the sort", async () => {
    const onSortingChange = vi.fn();
    await render(
      <Events defaultSorting={[{ id: "title", desc: false }]} onSortingChange={onSortingChange} />,
    );
    sortButton("Start").focus();
    await userEvent.keyboard("{Enter}");
    expect(onSortingChange).toHaveBeenCalledTimes(1);
    expect(onSortingChange).toHaveBeenLastCalledWith([{ id: "start", desc: false }]);
    await userEvent.keyboard(" ");
    expect(onSortingChange).toHaveBeenCalledTimes(2);
    expect(onSortingChange).toHaveBeenLastCalledWith([{ id: "start", desc: true }]);
  });

  // Pins the platform behaviour the Shift+Space handler relies on: a button activated by Space
  // clicks on keyup only when its keydown was not prevented.
  it("a prevented Space keydown on a button fires no keyup click (Chromium)", async () => {
    const onClick = vi.fn();
    const onPlainClick = vi.fn();
    const screen = await render(
      <>
        <button type="button" onClick={onClick} onKeyDown={(event) => event.preventDefault()}>
          Prevented
        </button>
        <button type="button" onClick={(event) => onPlainClick(event.shiftKey)}>
          Plain
        </button>
      </>,
    );
    screen.getByRole("button", { name: "Prevented" }).element().focus();
    await userEvent.keyboard("{Shift>} {/Shift}");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onClick).not.toHaveBeenCalled();
    // Unprevented, each key clicks once and the click carries Shift: without the
    // preventDefault a Shift+Enter / Shift+Space would toggle twice.
    screen.getByRole("button", { name: "Plain" }).element().focus();
    await userEvent.keyboard("{Shift>} {/Shift}");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onPlainClick.mock.calls).toEqual([[true], [true]]);
  });

  it("a plain click on another column replaces the sort", async () => {
    await render(
      <Events
        defaultSorting={[
          { id: "title", desc: false },
          { id: "start", desc: false },
        ]}
      />,
    );
    await userEvent.click(sortButton("Start"));
    await expect.element(head("Start")).toHaveAttribute("aria-sort", "ascending");
    expect(head("Title").hasAttribute("aria-sort")).toBe(false);
    expect(qa('[data-slot="data-table-sort-priority"]')).toHaveLength(0);
  });

  it("sorting resets to the first page", async () => {
    await render(<Events />);
    await userEvent.click(page.getByRole("button", { name: "Page 2" }));
    await expect.element(range()).toHaveTextContent("Showing 6–10 of 12");
    await userEvent.click(sortButton("Attendees"));
    await expect.element(range()).toHaveTextContent("Showing 1–5 of 12");
    await expect
      .element(page.getByRole("button", { name: "Page 1" }))
      .toHaveAttribute("aria-current", "page");
  });

  it("the multi-sort hint describes the table; no hint without multi-sort", async () => {
    const screen = await render(<Events />);
    await expect
      .element(screen.getByRole("table"))
      .toHaveAccessibleDescription("Shift-click to sort by more than one column");
    const hint = q('[data-slot="data-table-sort-hint"]');
    expect(hint.className).toContain("sr-only");
    expect(qa('[data-slot="data-table-sort-hint"]')).toHaveLength(1);
  });

  it("renders no hint when multi-sort is off or nothing is sortable", async () => {
    await render(<Events enableMultiSort={false} />);
    expect(q('[data-slot="data-table-sort-hint"]')).toBeNull();
    expect(table().hasAttribute("aria-describedby")).toBe(false);
  });

  it("renders no hint when no column is sortable", async () => {
    await render(<Events columns={[actionsColumn, { id: "x", header: "X", cell: () => "x" }]} />);
    expect(q('[data-slot="data-table-sort-hint"]')).toBeNull();
  });

  it("localises the sort strings", async () => {
    await render(
      <Events
        tableProps={{
          sortStateLabel: (direction, priority, count) => `${direction}:${priority}/${count}`,
          sortAnnouncement: (label, direction, count) => `${label}|${direction}|${count}`,
          multiSortHint: "Umschalt-Klick",
        }}
      />,
    );
    await userEvent.click(sortButton("Title"));
    await expect.element(status()).toHaveTextContent("Title|ascending|1");
    expect(q(".sr-only", sortButton("Title")).textContent).toContain("ascending:1/1");
    expect(q('[data-slot="data-table-sort-hint"]').textContent).toBe("Umschalt-Klick");
  });
});

describe("DataTable: selection", () => {
  it("multiple: named row checkboxes, the selected row state and the header checkbox states", async () => {
    const screen = await render(<Events selectionMode="multiple" />);
    // The selection column comes first.
    expect(headRow().cells[0]?.getAttribute("data-slot")).toBe("data-table-select-head");
    expect(rows()[0]?.cells[0]?.getAttribute("data-slot")).toBe("data-table-select-cell");
    const all = screen.getByRole("checkbox", { name: "Select all rows on this page" });
    await expect.element(all).toHaveAttribute("data-slot", "data-table-select-all");
    await expect.element(all).toHaveAttribute("aria-checked", "false");
    const launch = screen.getByRole("checkbox", { name: "Select Launch party" });
    await expect.element(launch).toHaveAttribute("data-slot", "data-table-select-row");
    await userEvent.click(launch);
    await expect.element(launch).toHaveAttribute("aria-checked", "true");
    expect(rowOf("Launch party").getAttribute("data-state")).toBe("selected");
    expect(rowOf("Launch party").hasAttribute("aria-selected")).toBe(false);
    expect(rowOf("Expo").hasAttribute("data-state")).toBe(false);
    await expect.element(all).toHaveAttribute("aria-checked", "mixed");
    await userEvent.click(all);
    await expect.element(all).toHaveAttribute("aria-checked", "true");
    expect(rows().every((tr) => tr.getAttribute("data-state") === "selected")).toBe(true);
    await userEvent.click(all);
    await expect.element(all).toHaveAttribute("aria-checked", "false");
    expect(rows().some((tr) => tr.hasAttribute("data-state"))).toBe(false);
  });

  it("selection survives sorting and paging", async () => {
    const screen = await render(<Events selectionMode="multiple" />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Launch party" }));
    await userEvent.click(sortButton("Title"));
    // By title, Launch party is the 11th row: page 3.
    await userEvent.click(screen.getByRole("button", { name: "Page 3" }));
    await expect
      .element(screen.getByRole("checkbox", { name: "Select Launch party" }))
      .toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("button", { name: "Page 1" }));
    await expect
      .element(screen.getByRole("checkbox", { name: "Select Expo" }))
      .toHaveAttribute("aria-checked", "false");
  });

  it("isRowSelectable disables a row checkbox and the header ignores it", async () => {
    const screen = await render(
      <Events selectionMode="multiple" isRowSelectable={(row) => row.id !== "e2"} />,
    );
    const board = screen.getByRole("checkbox", { name: "Select Board meeting" });
    await expect.element(board).toHaveAttribute("data-disabled");
    const all = screen.getByRole("checkbox", { name: "Select all rows on this page" });
    await userEvent.click(all);
    await expect.element(all).toHaveAttribute("aria-checked", "true");
    await expect.element(board).toHaveAttribute("aria-checked", "false");
  });

  it("the header checkbox is disabled on an empty page", async () => {
    const screen = await render(<Events selectionMode="multiple" data={[]} />);
    await expect
      .element(screen.getByRole("checkbox", { name: "Select all rows on this page" }))
      .toHaveAttribute("data-disabled");
  });

  it("single: native radios sharing one name per table; no header checkbox", async () => {
    const screen = await render(
      <>
        <Events selectionMode="single" pager={false} />
        <Events selectionMode="single" pager={false} tableProps={{ caption: "Other" }} />
      </>,
    );
    expect(screen.getByRole("checkbox").elements()).toHaveLength(0);
    const [first, second] = qa<HTMLTableElement>('[data-slot="data-table"]');
    if (!first || !second) throw new Error("tables missing");
    const selectHead = q('[data-slot="data-table-select-head"]', first);
    expect(selectHead.textContent).toBe("Select");
    expect(q(".sr-only", selectHead).textContent).toBe("Select");
    const radios = qa<HTMLInputElement>('input[type="radio"]', first);
    expect(radios).toHaveLength(5);
    const name = radios[0]?.name;
    expect(name).toBeTruthy();
    expect(radios.every((radio) => radio.name === name)).toBe(true);
    const otherName = qa<HTMLInputElement>('input[type="radio"]', second)[0]?.name;
    expect(otherName).toBeTruthy();
    expect(otherName).not.toBe(name);
    expect(radios[0]?.getAttribute("aria-label")).toBe("Select Launch party");
    expect(radios[0]?.getAttribute("data-slot")).toBe("data-table-select-row");
  });

  it("single: a click selects its row and clears the previous; ↓ selects the next row", async () => {
    const onRowSelectionChange = vi.fn();
    const screen = await render(
      <Events selectionMode="single" onRowSelectionChange={onRowSelectionChange} />,
    );
    await userEvent.click(screen.getByRole("radio", { name: "Select Board meeting" }));
    await expect.poll(() => rowOf("Board meeting").getAttribute("data-state")).toBe("selected");
    await userEvent.click(screen.getByRole("radio", { name: "Select Expo" }));
    await expect.poll(() => rowOf("Expo").getAttribute("data-state")).toBe("selected");
    expect(rowOf("Board meeting").hasAttribute("data-state")).toBe(false);
    expect(onRowSelectionChange).toHaveBeenLastCalledWith(["e5"]);
    await userEvent.click(screen.getByRole("radio", { name: "Select Code review" }));
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(() => rowOf("Design sprint").getAttribute("data-state")).toBe("selected");
    expect(onRowSelectionChange).toHaveBeenLastCalledWith(["e4"]);
    await expect.element(screen.getByRole("radio", { name: "Select Design sprint" })).toBeChecked();
    expect(rowOf("Code review").hasAttribute("data-state")).toBe(false);
  });

  it("single: the radios are one Tab stop", async () => {
    await render(<Events selectionMode="single" columns={dataColumns} pager={false} />);
    const sequence = await tabSequence(6);
    const radios = sequence.filter((element) => element instanceof HTMLInputElement);
    expect(radios).toHaveLength(1);
  });
});

describe("DataTable: pagination", () => {
  it("shows the range; Previous, page and Next are buttons; the current page is marked", async () => {
    const screen = await render(<Events />);
    await expect.element(range()).toHaveTextContent("Showing 1–5 of 12");
    expect(q('[data-slot="data-table-pagination"]').contains(range())).toBe(true);
    await expect.element(screen.getByRole("navigation", { name: "Pagination" })).toBeVisible();
    for (const name of ["Page 1", "Page 2", "Page 3", "Go to next page"]) {
      expect(screen.getByRole("button", { name }).element().tagName).toBe("BUTTON");
    }
    expect(previous().tagName).toBe("BUTTON");
    expect(previous().getAttribute("type")).toBe("button");
    expect(previous().getAttribute("aria-disabled")).toBe("true");
    expect(previous().tabIndex).toBe(-1);
    expect(previous().hasAttribute("disabled")).toBe(false);
    await expect
      .element(screen.getByRole("button", { name: "Page 1" }))
      .toHaveAttribute("aria-current", "page");
  });

  it("Enter on Next pages to the end and keeps focus on the now-disabled Next", async () => {
    await render(<Events />);
    next().focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(range()).toHaveTextContent("Showing 6–10 of 12");
    await expect.element(pagerStatus()).toHaveTextContent("Showing 6–10 of 12");
    expect(previous().hasAttribute("aria-disabled")).toBe(false);
    expect(previous().tabIndex).toBe(0);
    await userEvent.keyboard("{Enter}");
    await expect.element(range()).toHaveTextContent("Showing 11–12 of 12");
    await expect.element(next()).toHaveAttribute("aria-disabled", "true");
    expect(next().tabIndex).toBe(-1);
    expect(document.activeElement).toBe(next());
    // A disabled Next ignores Enter.
    await userEvent.keyboard("{Enter}");
    expect(range().textContent).toBe("Showing 11–12 of 12");
    previous().focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(range()).toHaveTextContent("Showing 6–10 of 12");
  });

  it("the pagination status speaks after a pager action, never after a sort", async () => {
    const screen = await render(<Events />);
    await userEvent.click(screen.getByRole("button", { name: "Page 3" }));
    await expect.element(pagerStatus()).toHaveTextContent("Showing 11–12 of 12");
    await userEvent.click(sortButton("Title"));
    await expect.element(range()).toHaveTextContent("Showing 1–5 of 12");
    await expect.element(status()).toHaveTextContent("Sorted by Title, ascending");
    // Only the sort status spoke: the pagination status still holds its last text.
    expect(pagerStatus().textContent).toBe("Showing 11–12 of 12");
    // Enter on a sort button: only the sort status changes.
    sortButton("Start").focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(status()).toHaveTextContent("Sorted by Start, ascending");
    expect(pagerStatus().textContent).toBe("Showing 11–12 of 12");
  });

  it("a click on the current page leaves nothing pending: a later sort speaks in one region only", async () => {
    const screen = await render(<Events />);
    await userEvent.click(screen.getByRole("button", { name: "Page 3" }));
    await expect.element(pagerStatus()).toHaveTextContent("Showing 11–12 of 12");
    await userEvent.click(screen.getByRole("button", { name: "Page 3" }));
    await userEvent.click(sortButton("Title"));
    await expect.element(range()).toHaveTextContent("Showing 1–5 of 12");
    await expect.element(status()).toHaveTextContent("Sorted by Title, ascending");
    expect(pagerStatus().textContent).toBe("Showing 11–12 of 12");
  });

  it("a change a controlled parent refuses leaves nothing pending for a later change", async () => {
    function Refusing() {
      const [sorting, setSorting] = useState<SortingState>([]);
      const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 5 });
      const table = useDataTable<Event>({
        data: events,
        columns,
        getRowId: (row) => row.id,
        sorting,
        // Refuses a sort by Title and the third page.
        onSortingChange: (next) => next[0]?.id !== "title" && setSorting(next),
        pagination,
        onPaginationChange: (next) => next.pageIndex !== 2 && setPagination(next),
      });
      return (
        <>
          <Button onClick={() => table.setSorting([{ id: "start", desc: false }])}>
            Sort by start
          </Button>
          <DataTable table={table} caption="Events" />
          <DataTablePagination table={table} />
        </>
      );
    }
    const screen = await render(<Refusing />);
    await userEvent.click(screen.getByRole("button", { name: "Page 2" }));
    await expect.element(pagerStatus()).toHaveTextContent("Showing 6–10 of 12");
    await userEvent.click(screen.getByRole("button", { name: "Page 3" }));
    await userEvent.click(sortButton("Title"));
    expect(head("Title").hasAttribute("aria-sort")).toBe(false);
    // A sort from outside the table: it resets the page and neither region speaks.
    await userEvent.click(screen.getByRole("button", { name: "Sort by start" }));
    await expect.element(head("Start")).toHaveAttribute("aria-sort", "ascending");
    await expect.element(range()).toHaveTextContent("Showing 1–5 of 12");
    expect(status().textContent).toBe("");
    expect(pagerStatus().textContent).toBe("Showing 6–10 of 12");
  });

  it("page sizes: 10 shows 1–10 and keeps the first visible row", async () => {
    const screen = await render(<Events paginationProps={{ pageSizeOptions: [5, 10, 20] }} />);
    await userEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(titles()[0]).toBe("Fundraiser");
    const size = screen.getByRole("combobox", { name: "Rows per page" });
    await expect.element(size).toHaveTextContent("5");
    await userEvent.click(size);
    await userEvent.click(screen.getByRole("option", { name: "10" }));
    await expect.element(range()).toHaveTextContent("Showing 1–10 of 12");
    expect(titles()).toContain("Fundraiser");
    await expect.element(pagerStatus()).toHaveTextContent("Showing 1–10 of 12");
    await expect.element(size).toHaveTextContent("10");
  });

  it("no rows: 'No results' and a single disabled page", async () => {
    await render(<Events data={[]} />);
    await expect.element(range()).toHaveTextContent("No results");
    expect(previous().getAttribute("aria-disabled")).toBe("true");
    expect(next().getAttribute("aria-disabled")).toBe("true");
  });

  it("localises the pager strings", async () => {
    const screen = await render(
      <Events
        paginationProps={{
          rangeLabel: (from, to, total) => `${from} bis ${to} von ${total}`,
          paginationLabel: "Seiten",
          pageLabel: (page) => `Seite ${page}`,
          pageSizeOptions: [5, 10],
          pageSizeLabel: "Zeilen pro Seite",
        }}
      />,
    );
    await expect.element(range()).toHaveTextContent("1 bis 5 von 12");
    await expect.element(screen.getByRole("navigation", { name: "Seiten" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Seite 2" })).toBeVisible();
    await expect.element(screen.getByRole("combobox", { name: "Zeilen pro Seite" })).toBeVisible();
  });
});

describe("DataTable: columns menu", () => {
  it("lists hideable columns; unchecking hides the column; the menu stays open", async () => {
    const screen = await render(<Events menu />);
    const trigger = screen.getByRole("button", { name: "Columns" });
    await expect.element(trigger).toHaveAttribute("data-slot", "data-table-columns-trigger");
    await userEvent.click(trigger);
    const items = screen.getByRole("menuitemcheckbox");
    await expect
      .poll(() => items.elements().map((item) => item.textContent))
      .toEqual(["Title", "Start", "Attendees"]);
    const attendees = screen.getByRole("menuitemcheckbox", { name: "Attendees" });
    await expect.element(attendees).toHaveAttribute("aria-checked", "true");
    await userEvent.click(attendees);
    await expect.element(attendees).toHaveAttribute("aria-checked", "false");
    expect(heads().map((th) => th.textContent)).toEqual(["Title", "Start", "Actions"]);
    expect(rows()[0]?.cells).toHaveLength(3);
    await expect.element(screen.getByRole("menu")).toBeVisible();
    await userEvent.click(attendees);
    await expect
      .poll(() => heads().map((th) => th.textContent))
      .toEqual(["Title", "Start", "Attendees", "Actions"]);
  });

  it("the last visible column's item is disabled", async () => {
    const screen = await render(<Events menu columns={dataColumns} />);
    await userEvent.click(screen.getByRole("button", { name: "Columns" }));
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Start" }));
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Attendees" }));
    const title = screen.getByRole("menuitemcheckbox", { name: "Title" });
    await expect.element(title).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(title, { force: true });
    expect(heads().map((th) => th.textContent)).toEqual(["Title"]);
    // A hidden column's item stays enabled, to show it again.
    const start = screen.getByRole("menuitemcheckbox", { name: "Start" });
    expect(start.element().hasAttribute("aria-disabled")).toBe(false);
  });

  it("takes a label", async () => {
    const screen = await render(<Events menu columns={dataColumns} />);
    await expect.element(screen.getByRole("button", { name: "Columns" })).toBeVisible();
    const custom = await render(<DataTableColumnsMenuProbe />);
    await expect.element(custom.getByRole("button", { name: "Spalten" })).toBeVisible();
  });
});

function DataTableColumnsMenuProbe() {
  const table = useDataTable<Event>({ data: events, columns: dataColumns });
  return <DataTableColumnsMenu table={table} label="Spalten" />;
}

describe("DataTable: empty and loading", () => {
  it("no rows: one cell spanning every column with 'No results.'", async () => {
    await render(<Events data={[]} selectionMode="multiple" />);
    const empty = q('[data-slot="data-table-empty"]');
    expect(empty.tagName).toBe("TR");
    const cell = empty.querySelector("td") as HTMLTableCellElement;
    expect(cell.colSpan).toBe(5);
    expect(cell.textContent).toBe("No results.");
    expect(
      Math.abs(cell.getBoundingClientRect().width - headRow().getBoundingClientRect().width),
    ).toBeLessThanOrEqual(1);
    expect(getComputedStyle(cell).textAlign).toBe("center");
  });

  it("takes custom empty content", async () => {
    await render(<Events data={[]} tableProps={{ empty: "No events match." }} />);
    expect(q('[data-slot="data-table-empty"]').textContent).toBe("No events match.");
  });

  it("loading: aria-busy, hidden skeleton rows, an interactive header and pager", async () => {
    function Toggle() {
      const [loading, setLoading] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setLoading(false)}>
            Done
          </button>
          <Events selectionMode="multiple" tableProps={{ loading }} />
        </>
      );
    }
    const screen = await render(<Toggle />);
    expect(table().getAttribute("aria-busy")).toBe("true");
    expect(rows()).toHaveLength(0);
    const loadingRows = qa('[data-slot="data-table-loading-row"]');
    expect(loadingRows).toHaveLength(5);
    for (const tr of loadingRows) {
      expect(tr.getAttribute("aria-hidden")).toBe("true");
      expect(tr.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(5);
    }
    // The header and the pager stay interactive; the header checkbox has no rows to select.
    expect(sortButton("Title").disabled).toBe(false);
    expect(next().hasAttribute("aria-disabled")).toBe(false);
    await expect
      .element(screen.getByRole("checkbox", { name: "Select all rows on this page" }))
      .toHaveAttribute("data-disabled");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await expect.poll(() => rows().length).toBe(5);
    expect(table().hasAttribute("aria-busy")).toBe(false);
    expect(qa('[data-slot="data-table-loading-row"]')).toHaveLength(0);
  });

  it("loadingRows sets the count; it defaults to min(pageSize, 5)", async () => {
    await render(
      <Events defaultPagination={{ pageIndex: 0, pageSize: 3 }} tableProps={{ loading: true }} />,
    );
    expect(qa('[data-slot="data-table-loading-row"]')).toHaveLength(3);
  });

  it("loadingRows is honoured", async () => {
    await render(<Events tableProps={{ loading: true, loadingRows: 2 }} />);
    expect(qa('[data-slot="data-table-loading-row"]')).toHaveLength(2);
  });

  it("headerClassName widths keep the columns identical loading and loaded", async () => {
    const sized = columns.map((column) => ({ ...column, headerClassName: "w-40" }));
    function Toggle() {
      const [loading, setLoading] = useState(true);
      return (
        <div style={{ width: 900 }}>
          <button type="button" onClick={() => setLoading(false)}>
            Done
          </button>
          <Events columns={sized} tableProps={{ loading }} />
        </div>
      );
    }
    const screen = await render(<Toggle />);
    const widths = () => heads().map((th) => th.getBoundingClientRect().width);
    const loadingWidths = widths();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await expect.poll(() => rows().length).toBe(5);
    const loadedWidths = widths();
    loadingWidths.forEach((width, i) => {
      expect(Math.abs(width - (loadedWidths[i] as number))).toBeLessThanOrEqual(1);
    });
  });
});

describe("DataTable: keyboard", () => {
  it("Tab order: header checkbox → sort buttons → row checkboxes and cell buttons → pager", async () => {
    await render(<Events selectionMode="multiple" />);
    const sequence = (await tabSequence(18)).map(describeFocus);
    expect(sequence).toEqual([
      "data-table-select-all:Select all rows on this page",
      "data-table-sort-button:Title",
      "data-table-sort-button:Start",
      "data-table-sort-button:Attendees",
      "data-table-select-row:Select Launch party",
      "button:Edit Launch party",
      "data-table-select-row:Select Board meeting",
      "button:Edit Board meeting",
      "data-table-select-row:Select Code review",
      "button:Edit Code review",
      "data-table-select-row:Select Design sprint",
      "button:Edit Design sprint",
      "data-table-select-row:Select Expo",
      "button:Edit Expo",
      "pagination-link:Page 1",
      "pagination-link:Page 2",
      "pagination-link:Page 3",
      "pagination-next:Go to next page",
    ]);
  });

  it("Space toggles a focused checkbox; Enter sorts", async () => {
    const screen = await render(<Events selectionMode="multiple" />);
    const launch = screen.getByRole("checkbox", { name: "Select Launch party" });
    (launch.element() as HTMLElement).focus();
    await userEvent.keyboard(" ");
    await expect.element(launch).toHaveAttribute("aria-checked", "true");
    const all = screen.getByRole("checkbox", { name: "Select all rows on this page" });
    (all.element() as HTMLElement).focus();
    await userEvent.keyboard(" ");
    await expect.element(all).toHaveAttribute("aria-checked", "true");
    sortButton("Attendees").focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(head("Attendees")).toHaveAttribute("aria-sort", "ascending");
    expect(titles()[0]).toBe("Investor call");
  });
});

describe("DataTable: alignment and direction", () => {
  it("LTR: headers start-aligned; the end-aligned column's header and cells sit at the right", async () => {
    await render(<Events />);
    const th = head("Attendees");
    expect(getComputedStyle(head("Title")).textAlign).toBe("start");
    expect(getComputedStyle(th).textAlign).toBe("end");
    const button = sortButton("Attendees");
    // The sort button hangs 8px into the cell's end padding and not into the start.
    expect(getComputedStyle(button).marginInlineStart).toBe("0px");
    expect(getComputedStyle(button).marginInlineEnd).toBe("-8px");
    const thRect = th.getBoundingClientRect();
    expect(thRect.right - button.getBoundingClientRect().right).toBeCloseTo(4, 0);
    const startButton = sortButton("Title");
    expect(
      startButton.getBoundingClientRect().left - head("Title").getBoundingClientRect().left,
    ).toBeCloseTo(4, 0);
    const cell = qa('[data-slot="data-table-cell"]', rows()[0] as Element)[2] as HTMLElement;
    expect(getComputedStyle(cell).textAlign).toBe("end");
    expect(cell.getBoundingClientRect().right - textRect(cell, "120").right).toBeCloseTo(12, 0);
  });

  it("RTL: headers sit right, the sort icon left of the label, the end column at the left, the chevrons flip", async () => {
    await render(
      <div dir="rtl">
        <Events />
      </div>,
    );
    const titleHead = head("Title");
    const titleButton = sortButton("Title");
    // Start = right: the button hangs 8px into the cell's right padding.
    expect(
      titleHead.getBoundingClientRect().right - titleButton.getBoundingClientRect().right,
    ).toBeCloseTo(4, 0);
    const icon = titleButton.querySelector("svg") as SVGElement;
    expect(icon.getBoundingClientRect().right).toBeLessThanOrEqual(
      textRect(titleButton, "Title").left + 0.5,
    );
    const firstCell = qa('[data-slot="data-table-cell"]', rows()[0] as Element)[0] as HTMLElement;
    expect(
      firstCell.getBoundingClientRect().right - textRect(firstCell, "Launch party").right,
    ).toBeCloseTo(12, 0);
    const endCell = qa('[data-slot="data-table-cell"]', rows()[0] as Element)[2] as HTMLElement;
    expect(textRect(endCell, "120").left - endCell.getBoundingClientRect().left).toBeCloseTo(12, 0);
    const endButton = sortButton("Attendees");
    expect(
      endButton.getBoundingClientRect().left - head("Attendees").getBoundingClientRect().left,
    ).toBeCloseTo(4, 0);
    // The Previous chevron points right (mirrored), Next's left.
    expect(getComputedStyle(previous().querySelector("svg") as SVGElement).scale).toBe("-1 1");
    expect(getComputedStyle(next().querySelector("svg") as SVGElement).scale).toBe("-1 1");
    const prevIcon = previous().querySelector("svg") as SVGElement;
    expect(getComputedStyle(prevIcon).scale).not.toBe("none");
  });

  it("LTR: the pager chevrons are not mirrored", async () => {
    await render(<Events />);
    expect(getComputedStyle(previous().querySelector("svg") as SVGElement).scale).toBe("none");
  });
});

describe("DataTable: focus, forced colors and motion", () => {
  it("every focusable part shows a solid 2px ring on Tab focus", async () => {
    const screen = await render(
      <Events selectionMode="multiple" menu defaultPagination={{ pageIndex: 1, pageSize: 5 }} />,
    );
    const focusable = qa(
      '[data-slot="data-table-columns-trigger"], [data-slot="data-table-select-all"], [data-slot="data-table-sort-button"], [data-slot="data-table-select-row"], [data-slot^="pagination-"]:is(button)',
    );
    for (const element of focusable) {
      expect(getComputedStyle(element).outlineStyle, describeFocus(element)).toBe("none");
    }
    const slots = new Set<string | null>();
    // The trigger, the header checkbox, 3 sort buttons, 5 × (row checkbox, Edit), the pager's 5.
    for (let i = 0; i < 20; i++) {
      await userEvent.tab();
      const focused = document.activeElement as HTMLElement;
      slots.add(focused.getAttribute("data-slot"));
      const style = getComputedStyle(focused);
      expect(style.outlineStyle, describeFocus(focused)).toBe("solid");
      expect(style.outlineWidth, describeFocus(focused)).toBe("2px");
    }
    for (const slot of [
      "data-table-columns-trigger",
      "data-table-select-all",
      "data-table-sort-button",
      "data-table-select-row",
      "pagination-previous",
      "pagination-link",
      "pagination-next",
    ]) {
      expect(slots).toContain(slot);
    }
    // The columns menu's items (keyboard-opened, so the first is highlighted and focused).
    (screen.getByRole("button", { name: "Columns" }).element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    const first = screen.getByRole("menuitemcheckbox", { name: "Title" });
    await expect.poll(() => document.activeElement).toBe(first.element());
    expect(getComputedStyle(first.element()).outlineStyle).toBe("solid");
  });

  it("the single-selection radio shows a 2px solid ring on Tab focus", async () => {
    await render(<Events selectionMode="single" columns={dataColumns} pager={false} />);
    const radio = q<HTMLInputElement>('input[type="radio"]');
    expect(getComputedStyle(radio).outlineStyle).toBe("none");
    // The three sort buttons, then the radio group's one stop.
    await tabSequence(4);
    expect(document.activeElement).toBe(radio);
    expect(getComputedStyle(radio).outlineStyle).toBe("solid");
    expect(getComputedStyle(radio).outlineWidth).toBe("2px");
  });

  it("forced colors: a selected row is Highlight; its checkbox is system-painted; rings Highlight; badge border", async () => {
    await emulateForcedColors(true);
    await render(
      <Events
        selectionMode="multiple"
        defaultSorting={[
          { id: "start", desc: false },
          { id: "title", desc: false },
        ]}
      />,
    );
    const highlight = systemColor("Highlight");
    const row = rowOf("Kickoff");
    expect(row.hasAttribute("data-state")).toBe(false);
    await userEvent.click(page.getByRole("checkbox", { name: "Select Kickoff" }));
    await expect.poll(() => row.getAttribute("data-state")).toBe("selected");
    const style = getComputedStyle(row);
    // TableRow's `transition-colors` animates the fill in.
    await expect.poll(() => style.backgroundColor).toBe(highlight);
    expect(style.color).toBe(systemColor("HighlightText"));
    expect(style.forcedColorAdjust).toBe("none");
    const cell = q('[data-slot="data-table-select-cell"]', row);
    expect(getComputedStyle(cell).forcedColorAdjust).toBe("auto");
    const checkbox = q('[data-slot="data-table-select-row"]', row);
    expect(getComputedStyle(checkbox).forcedColorAdjust).toBe("auto");
    expect(getComputedStyle(checkbox).borderTopColor).not.toBe(style.backgroundColor);
    // The priority badge keeps a CanvasText border.
    const badge = q('[data-slot="data-table-sort-priority"]');
    expect(getComputedStyle(badge).borderTopStyle).toBe("solid");
    expect(getComputedStyle(badge).borderTopColor).toBe(systemColor("CanvasText"));
    // The sort button's ring is Highlight, and absent before focus.
    const button = sortButton("Title");
    expect(getComputedStyle(button).outlineStyle).toBe("none");
    button.blur();
    q('[data-slot="data-table-select-all"]').focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    expect(getComputedStyle(button).outlineStyle).toBe("solid");
    expect(getComputedStyle(button).outlineColor).toBe(highlight);
  });

  it("forced colors: a button in a selected row's cell keeps system colours, not the row's Highlight pair", async () => {
    await emulateForcedColors(true);
    await render(<Events selectionMode="multiple" defaultRowSelection={["e1"]} />);
    const row = rowOf("Launch party");
    expect(row.getAttribute("data-state")).toBe("selected");
    await expect.poll(() => getComputedStyle(row).backgroundColor).toBe(systemColor("Highlight"));
    const edit = page.getByRole("button", { name: "Edit Launch party" }).element() as HTMLElement;
    const style = getComputedStyle(edit);
    // Inheriting the row's `forced-color-adjust: none`, the outline Button kept its theme colours:
    // dark text on the Highlight fill. Repainted, it is ButtonText on its own system background.
    expect(style.forcedColorAdjust).toBe("auto");
    expect(style.color).toBe(systemColor("ButtonText"));
    expect(style.backgroundColor).not.toBe(systemColor("Highlight"));
    // The row's own text keeps the Highlight pair.
    expect(getComputedStyle(row).color).toBe(systemColor("HighlightText"));
  });

  it("reduced motion: the sort button has no transition", async () => {
    await render(<Events />);
    expect(getComputedStyle(sortButton("Title")).transitionProperty).not.toBe("none");
    await emulateReducedMotion(true);
    expect(getComputedStyle(sortButton("Title")).transitionProperty).toBe("none");
  });
});

describe("DataTable: SSR", () => {
  it("renderToString gives the sorted first page and aria-sort; hydration raises no recoverable error", async () => {
    const element = (
      <Events
        locale="en-US"
        selectionMode="multiple"
        defaultSorting={[{ id: "title", desc: true }]}
      />
    );
    const html = renderToString(element);
    expect(html).toContain('aria-sort="descending"');
    expect(html.indexOf("Lunch &amp; learn")).toBeGreaterThan(-1);
    expect(html).not.toContain("Board meeting");
    expect(html).toContain('data-slot="data-table-select-row"');
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const hydrated = hydrateRoot(container, element, { onRecoverableError });
    try {
      await expect
        .poll(() => container.querySelector('[data-slot="data-table-select-all"]'))
        .not.toBeNull();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
      hydrated.unmount();
      container.remove();
    }
  });
});

describe("DataTable: 390px", () => {
  it("the table scrolls inside its container; the page does not overflow", async () => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    await page.viewport(390, 800);
    try {
      await render(
        <div className="p-4">
          <Events selectionMode="multiple" menu paginationProps={{ pageSizeOptions: [5, 10] }} />
        </div>,
      );
      const container = q('[data-slot="table-container"]');
      expect(container.scrollWidth).toBeGreaterThan(container.clientWidth);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
      const pager = q('[data-slot="data-table-pagination"]');
      expect(pager.getBoundingClientRect().right).toBeLessThanOrEqual(390);
      for (const button of qa("button", pager)) {
        expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(390);
      }
      // The container scrolls to its end: the last column's buttons come into view.
      container.scrollLeft = container.scrollWidth;
      const edit = page.getByRole("button", { name: "Edit Launch party" }).element();
      await expect.poll(() => edit.getBoundingClientRect().right).toBeLessThanOrEqual(390);
    } finally {
      await page.viewport(viewport.width, viewport.height);
    }
  });
});

describe("DataTable: axe", () => {
  // Wide enough for the whole table: in a narrow frame axe reports the columns clipped by the
  // scroll container as partially obscured (needs review), which the 390px case covers instead.
  let viewport = { width: 0, height: 0 };
  beforeEach(async () => {
    viewport = { width: window.innerWidth, height: window.innerHeight };
    await page.viewport(1280, 900);
  });
  afterEach(async () => {
    await page.viewport(viewport.width, viewport.height);
  });
  const themes = ["light", "dark"] as const;
  const frame = (theme: (typeof themes)[number], children: ReactNode) => (
    <div
      className={
        theme === "dark"
          ? "dark bg-background p-4 text-foreground"
          : "bg-background p-4 text-foreground"
      }
    >
      {children}
    </div>
  );

  it.each(themes)("default, sorted by two columns, selected (%s)", async (theme) => {
    const screen = await render(
      frame(
        theme,
        <Events selectionMode="multiple" menu paginationProps={{ pageSizeOptions: [5, 10] }} />,
      ),
    );
    await axeClean(screen.container);
    await userEvent.click(sortButton("Title"));
    await userEvent.keyboard("{Shift>}");
    await userEvent.click(sortButton("Start"));
    await userEvent.keyboard("{/Shift}");
    await expect.poll(() => qa('[data-slot="data-table-sort-priority"]').length).toBe(2);
    await axeClean(screen.container);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Board meeting" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Code review" }));
    await axeClean(screen.container);
  });

  it.each(themes)("single selection (%s)", async (theme) => {
    const screen = await render(
      frame(theme, <Events selectionMode="single" defaultRowSelection={["e2"]} />),
    );
    await axeClean(screen.container);
  });

  it.each(themes)("empty and loading (%s)", async (theme) => {
    const empty = await render(frame(theme, <Events selectionMode="multiple" data={[]} />));
    await axeClean(empty.container);
    const loading = await render(
      frame(theme, <Events selectionMode="multiple" tableProps={{ loading: true }} />),
    );
    await axeClean(loading.container);
  });

  it.each(themes)("RTL (%s)", async (theme) => {
    const screen = await render(
      frame(
        theme,
        <div dir="rtl">
          <Events selectionMode="multiple" defaultSorting={[{ id: "title", desc: false }]} />
        </div>,
      ),
    );
    await axeClean(screen.container);
  });

  it.each(themes)("the columns menu open (%s)", async (theme) => {
    const screen = await render(frame(theme, <Events menu />));
    if (theme === "dark") document.documentElement.classList.add("dark");
    try {
      await userEvent.click(screen.getByRole("button", { name: "Columns" }));
      const menu = screen.getByRole("menu");
      await expect.element(menu).toBeVisible();
      await waitForPopupSettled(menu.element());
      const audit = await auditOpenOverlay();
      expect(audit.violations).toEqual([]);
      expect(audit.incomplete).toEqual([]);
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });
});
