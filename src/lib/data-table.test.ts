import { describe, expect, it } from "vitest";
import {
  type ColumnVisibility,
  clampPageIndex,
  type DataTableColumn,
  defaultCompare,
  getPageCount,
  getPageSelection,
  getRowRange,
  getVisibleColumns,
  nextSorting,
  paginateRows,
  type SortingState,
  sortRows,
  toggleColumnVisibility,
  togglePageSelection,
  toggleRowSelection,
} from "./data-table";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

describe("nextSorting", () => {
  const asc = (id: string) => ({ id, desc: false });
  const desc = (id: string) => ({ id, desc: true });

  it.each<[string, SortingState, string, SortingState]>([
    ["unsorted → ascending", [], "a", [asc("a")]],
    ["ascending → descending", [asc("a")], "a", [desc("a")]],
    ["descending → cleared", [desc("a")], "a", []],
    ["another column replaces the sort", [asc("a")], "b", [asc("b")]],
    ["another column replaces a descending sort", [desc("a")], "b", [asc("b")]],
    ["a column of a multi-sort replaces it", [asc("a"), desc("b")], "b", [asc("b")]],
    ["the primary of a multi-sort replaces it", [desc("a"), asc("b")], "a", [asc("a")]],
  ])("plain: %s", (_, sorting, id, expected) => {
    expect(nextSorting(sorting, id, { multi: false })).toEqual(expected);
    // Plain is the default.
    expect(nextSorting(sorting, id)).toEqual(expected);
  });

  it.each<[string, SortingState, string, SortingState]>([
    ["appends ascending", [asc("a")], "b", [asc("a"), asc("b")]],
    ["starts a sort when empty", [], "a", [asc("a")]],
    [
      "flips ascending in place",
      [asc("a"), asc("b"), asc("c")],
      "b",
      [asc("a"), desc("b"), asc("c")],
    ],
    ["removes a descending entry", [asc("a"), desc("b"), asc("c")], "b", [asc("a"), asc("c")]],
    ["removes the primary when descending", [desc("a"), asc("b")], "a", [asc("b")]],
  ])("multi: %s", (_, sorting, id, expected) => {
    expect(nextSorting(sorting, id, { multi: true })).toEqual(expected);
  });

  it("multi beyond maxMultiSort drops the lowest-priority entry (default 3)", () => {
    const three = [asc("a"), desc("b"), asc("c")];
    expect(nextSorting(three, "d", { multi: true })).toEqual([asc("a"), desc("b"), asc("d")]);
    expect(nextSorting([asc("a"), asc("b")], "c", { multi: true, maxMultiSort: 2 })).toEqual([
      asc("a"),
      asc("c"),
    ]);
    expect(nextSorting([asc("a")], "b", { multi: true, maxMultiSort: 1 })).toEqual([asc("b")]);
    // Flipping inside the limit never drops anything.
    expect(nextSorting(three, "c", { multi: true })).toEqual([asc("a"), desc("b"), desc("c")]);
  });

  it("never mutates its input", () => {
    const sorting = Object.freeze([Object.freeze(asc("a")), Object.freeze(asc("b"))]);
    expect(() => nextSorting(sorting as SortingState, "a", { multi: true })).not.toThrow();
    expect(() => nextSorting(sorting as SortingState, "c", { multi: true })).not.toThrow();
    expect(sorting).toEqual([asc("a"), asc("b")]);
  });
});

describe("defaultCompare", () => {
  const sign = (value: number) => Math.sign(value);

  it("compares finite numbers by value", () => {
    expect(sign(defaultCompare(2, 10, collator))).toBe(-1);
    expect(sign(defaultCompare(10, 2, collator))).toBe(1);
    expect(defaultCompare(-1.5, -1.5, collator)).toBe(0);
  });

  it("compares dates by time", () => {
    const early = new Date("2026-01-02T09:00:00Z");
    const late = new Date("2026-01-10T09:00:00Z");
    expect(sign(defaultCompare(early, late, collator))).toBe(-1);
    expect(sign(defaultCompare(late, early, collator))).toBe(1);
    expect(defaultCompare(new Date(early), early, collator)).toBe(0);
  });

  it("orders booleans false before true", () => {
    expect(sign(defaultCompare(false, true, collator))).toBe(-1);
    expect(sign(defaultCompare(true, false, collator))).toBe(1);
    expect(defaultCompare(true, true, collator)).toBe(0);
  });

  it("compares strings with the collator: numeric, case- and accent-insensitive", () => {
    expect(sign(defaultCompare("item 2", "item 10", collator))).toBe(-1);
    expect(defaultCompare("Résumé", "resume", collator)).toBe(0);
    expect(defaultCompare("ABC", "abc", collator)).toBe(0);
    expect(sign(defaultCompare("apple", "Banana", collator))).toBe(-1);
  });

  it("falls back to the collator on the string forms for mixed or non-finite values", () => {
    expect(sign(defaultCompare(10, "9", collator))).toBe(1);
    expect(sign(defaultCompare(Number.NaN, 1, collator))).toBe(collator.compare("NaN", "1"));
  });

  it("uses a numeric, base-sensitivity collator when none is given", () => {
    expect(sign(defaultCompare("item 2", "item 10"))).toBe(-1);
    expect(defaultCompare("a", "A")).toBe(0);
  });
});

interface Person {
  name: string;
  age: number | null;
  city?: string | null;
  joined?: Date;
}

const nameColumn: DataTableColumn<Person> = {
  id: "name",
  header: "Name",
  accessor: (row) => row.name,
};
const ageColumn: DataTableColumn<Person> = { id: "age", header: "Age", accessor: (row) => row.age };
const cityColumn: DataTableColumn<Person> = {
  id: "city",
  header: "City",
  accessor: (row) => row.city,
};
const columns = [nameColumn, ageColumn, cityColumn];

const people: Person[] = [
  { name: "Cleo", age: 30, city: "Oslo" },
  { name: "ada", age: 25, city: null },
  { name: "Bea", age: 30, city: "Bergen" },
  { name: "Dan", age: null, city: "Oslo" },
  { name: "Eve", age: 25 },
];

const names = (rows: readonly Person[]) => rows.map((row) => row.name);

describe("sortRows", () => {
  it("returns a new array and never mutates the input", () => {
    const input = Object.freeze([...people]);
    const sorted = sortRows(input, [{ id: "name", desc: false }], columns, { collator });
    expect(sorted).not.toBe(input);
    expect(names(input)).toEqual(["Cleo", "ada", "Bea", "Dan", "Eve"]);
    // An empty sort is still a copy.
    const unsorted = sortRows(input, [], columns);
    expect(unsorted).not.toBe(input);
    expect(unsorted).toEqual(input);
  });

  it("sorts ascending and descending with the collator", () => {
    expect(names(sortRows(people, [{ id: "name", desc: false }], columns, { collator }))).toEqual([
      "ada",
      "Bea",
      "Cleo",
      "Dan",
      "Eve",
    ]);
    expect(names(sortRows(people, [{ id: "name", desc: true }], columns, { collator }))).toEqual([
      "Eve",
      "Dan",
      "Cleo",
      "Bea",
      "ada",
    ]);
  });

  it("is stable: equal keys keep their input order in both directions", () => {
    expect(names(sortRows(people, [{ id: "age", desc: false }], columns))).toEqual([
      "ada",
      "Eve",
      "Cleo",
      "Bea",
      "Dan",
    ]);
    expect(names(sortRows(people, [{ id: "age", desc: true }], columns))).toEqual([
      "Cleo",
      "Bea",
      "ada",
      "Eve",
      "Dan",
    ]);
  });

  it("sorts by several keys in priority order", () => {
    const sorting = [
      { id: "age", desc: true },
      { id: "name", desc: false },
    ];
    expect(names(sortRows(people, sorting, columns, { collator }))).toEqual([
      "Bea",
      "Cleo",
      "ada",
      "Eve",
      "Dan",
    ]);
    const byCityThenAge = [
      { id: "city", desc: false },
      { id: "age", desc: false },
    ];
    // Oslo: Dan (null age) after Cleo (30); the nullish cities last, in input order by age.
    expect(names(sortRows(people, byCityThenAge, columns, { collator }))).toEqual([
      "Bea",
      "Cleo",
      "Dan",
      "ada",
      "Eve",
    ]);
  });

  it("sorts null and undefined values last in both directions", () => {
    const asc = sortRows(people, [{ id: "city", desc: false }], columns, { collator });
    const desc = sortRows(people, [{ id: "city", desc: true }], columns, { collator });
    expect(names(asc).slice(-2)).toEqual(["ada", "Eve"]);
    expect(names(desc).slice(-2)).toEqual(["ada", "Eve"]);
    expect(names(desc).slice(0, 3)).toEqual(["Cleo", "Dan", "Bea"]);
  });

  it("uses a column's compare (negated when descending) over the accessor", () => {
    const byNameLength: DataTableColumn<Person> = {
      id: "length",
      header: "Length",
      compare: (a, b) => a.name.length - b.name.length,
    };
    const rows = [{ name: "Cleo" }, { name: "Al" }, { name: "Bea" }, { name: "Jo" }] as Person[];
    expect(names(sortRows(rows, [{ id: "length", desc: false }], [byNameLength]))).toEqual([
      "Al",
      "Jo",
      "Bea",
      "Cleo",
    ]);
    expect(names(sortRows(rows, [{ id: "length", desc: true }], [byNameLength]))).toEqual([
      "Cleo",
      "Bea",
      "Al",
      "Jo",
    ]);
  });

  it("sorts dates and numbers by value, not by their text", () => {
    const rows: Person[] = [
      { name: "a", age: 9, joined: new Date("2026-03-01") },
      { name: "b", age: 10, joined: new Date("2025-12-01") },
      { name: "c", age: 100, joined: new Date("2026-01-15") },
    ];
    const joined: DataTableColumn<Person> = {
      id: "joined",
      header: "Joined",
      accessor: (row) => row.joined,
    };
    expect(names(sortRows(rows, [{ id: "joined", desc: false }], [joined]))).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(names(sortRows(rows, [{ id: "age", desc: false }], columns))).toEqual(["a", "b", "c"]);
  });

  it("skips unknown and non-sortable ids", () => {
    const unsortableName = { ...nameColumn, sortable: false };
    const noAccessor: DataTableColumn<Person> = { id: "actions", header: "Actions" };
    const sorting = [
      { id: "missing", desc: false },
      { id: "name", desc: false },
      { id: "actions", desc: true },
      { id: "age", desc: false },
    ];
    expect(names(sortRows(people, sorting, [unsortableName, ageColumn, noAccessor]))).toEqual([
      "ada",
      "Eve",
      "Cleo",
      "Bea",
      "Dan",
    ]);
    // A column marked sortable but with nothing to sort by is skipped too.
    const sortableWithout = { ...noAccessor, sortable: true };
    expect(names(sortRows(people, [{ id: "actions", desc: false }], [sortableWithout]))).toEqual(
      names(people),
    );
  });

  it("defaults to a numeric, base-sensitivity collator for the locale", () => {
    const rows = [{ name: "item 10" }, { name: "Item 2" }, { name: "item 1" }] as Person[];
    expect(names(sortRows(rows, [{ id: "name", desc: false }], columns, { locale: "en" }))).toEqual(
      ["item 1", "Item 2", "item 10"],
    );
    // Swedish sorts "ä" after "z"; German sorts it with "a".
    const words = [{ name: "zebra" }, { name: "äpple" }] as Person[];
    expect(
      names(sortRows(words, [{ id: "name", desc: false }], columns, { locale: "sv" })),
    ).toEqual(["zebra", "äpple"]);
    expect(
      names(sortRows(words, [{ id: "name", desc: false }], columns, { locale: "de" })),
    ).toEqual(["äpple", "zebra"]);
  });
});

describe("paging", () => {
  it("getPageCount is at least 1", () => {
    expect(getPageCount(0, 10)).toBe(1);
    expect(getPageCount(1, 10)).toBe(1);
    expect(getPageCount(10, 10)).toBe(1);
    expect(getPageCount(11, 10)).toBe(2);
    expect(getPageCount(36, 5)).toBe(8);
  });

  it("getPageCount treats a page size that is not positive as one page", () => {
    expect(getPageCount(12, 0)).toBe(1);
    expect(getPageCount(12, -5)).toBe(1);
    expect(getPageCount(12, Number.NaN)).toBe(1);
  });

  it("clampPageIndex keeps the index on an existing page", () => {
    expect(clampPageIndex(0, 3)).toBe(0);
    expect(clampPageIndex(2, 3)).toBe(2);
    expect(clampPageIndex(3, 3)).toBe(2);
    expect(clampPageIndex(99, 3)).toBe(2);
    expect(clampPageIndex(-1, 3)).toBe(0);
    expect(clampPageIndex(1.7, 3)).toBe(1);
    expect(clampPageIndex(4, 0)).toBe(0);
    expect(clampPageIndex(Number.NaN, 3)).toBe(0);
  });

  it("paginateRows slices one page without mutating", () => {
    const rows = Object.freeze(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(paginateRows(rows, { pageIndex: 0, pageSize: 5 })).toEqual([1, 2, 3, 4, 5]);
    expect(paginateRows(rows, { pageIndex: 1, pageSize: 5 })).toEqual([6, 7, 8, 9, 10]);
    expect(paginateRows(rows, { pageIndex: 2, pageSize: 5 })).toEqual([11, 12]);
    // A page past the end is empty: callers clamp first.
    expect(paginateRows(rows, { pageIndex: 3, pageSize: 5 })).toEqual([]);
  });

  it("getRowRange is 1-based, with the last partial page and none", () => {
    expect(getRowRange({ pageIndex: 0, pageSize: 5 }, 12)).toEqual({ from: 1, to: 5 });
    expect(getRowRange({ pageIndex: 1, pageSize: 5 }, 12)).toEqual({ from: 6, to: 10 });
    expect(getRowRange({ pageIndex: 2, pageSize: 5 }, 12)).toEqual({ from: 11, to: 12 });
    expect(getRowRange({ pageIndex: 0, pageSize: 10 }, 0)).toEqual({ from: 0, to: 0 });
    expect(getRowRange({ pageIndex: 3, pageSize: 5 }, 12)).toEqual({ from: 0, to: 0 });
  });
});

describe("selection", () => {
  it("single: selects one id, or clears when it was the selected one", () => {
    expect(toggleRowSelection([], "a", "single")).toEqual(["a"]);
    expect(toggleRowSelection(["a"], "b", "single")).toEqual(["b"]);
    expect(toggleRowSelection(["a"], "a", "single")).toEqual([]);
  });

  it("multiple: adds or removes, keeping the order", () => {
    expect(toggleRowSelection([], "a", "multiple")).toEqual(["a"]);
    expect(toggleRowSelection(["c", "a"], "b", "multiple")).toEqual(["c", "a", "b"]);
    expect(toggleRowSelection(["c", "a", "b"], "a", "multiple")).toEqual(["c", "b"]);
  });

  it("none: returns the same selection", () => {
    const selection = ["a"];
    expect(toggleRowSelection(selection, "b", "none")).toBe(selection);
  });

  it("toggleRowSelection never mutates its input", () => {
    const selection = Object.freeze(["a", "b"]);
    expect(toggleRowSelection(selection, "a", "multiple")).toEqual(["b"]);
    expect(toggleRowSelection(selection, "c", "multiple")).toEqual(["a", "b", "c"]);
    expect(selection).toEqual(["a", "b"]);
  });

  it("getPageSelection: all, some or none of the page", () => {
    expect(getPageSelection(["a", "b", "x"], ["a", "b"])).toBe("all");
    expect(getPageSelection(["b"], ["a", "b"])).toBe("some");
    expect(getPageSelection(["x"], ["a", "b"])).toBe("none");
    expect(getPageSelection([], ["a", "b"])).toBe("none");
    // An empty page is never "all".
    expect(getPageSelection(["a"], [])).toBe("none");
  });

  it("togglePageSelection adds the missing page ids, keeping other pages' ids", () => {
    expect(togglePageSelection(["x", "b"], ["a", "b", "c"])).toEqual(["x", "b", "a", "c"]);
    expect(togglePageSelection([], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("togglePageSelection removes the page ids when the page is all selected", () => {
    expect(togglePageSelection(["x", "a", "b", "y"], ["a", "b"])).toEqual(["x", "y"]);
  });

  it("togglePageSelection on an empty page changes nothing", () => {
    const selection = ["x"];
    expect(togglePageSelection(selection, [])).toBe(selection);
  });
});

describe("column visibility", () => {
  const actions: DataTableColumn<Person> = { id: "actions", header: "", hideable: false };
  const all = [nameColumn, ageColumn, actions];

  it("getVisibleColumns keeps columns not set to false (a missing id is visible)", () => {
    expect(getVisibleColumns(all, {}).map((c) => c.id)).toEqual(["name", "age", "actions"]);
    expect(getVisibleColumns(all, { age: false, name: true }).map((c) => c.id)).toEqual([
      "name",
      "actions",
    ]);
  });

  it("toggleColumnVisibility hides and shows", () => {
    expect(toggleColumnVisibility({}, "age", all)).toEqual({ age: false });
    expect(toggleColumnVisibility({ age: false }, "age", all)).toEqual({ age: true });
  });

  it("refuses to hide a non-hideable column (the same object)", () => {
    const visibility: ColumnVisibility = {};
    expect(toggleColumnVisibility(visibility, "actions", all)).toBe(visibility);
  });

  it("refuses to hide the last visible column (the same object)", () => {
    const visibility: ColumnVisibility = { name: false };
    expect(toggleColumnVisibility(visibility, "age", [nameColumn, ageColumn])).toBe(visibility);
    // A visible non-hideable column counts: the last hideable one can go.
    expect(toggleColumnVisibility({ name: false }, "age", all)).toEqual({
      name: false,
      age: false,
    });
  });

  it("ignores an unknown id (the same object) and never mutates", () => {
    const visibility = Object.freeze({ age: false }) as ColumnVisibility;
    expect(toggleColumnVisibility(visibility, "missing", all)).toBe(visibility);
    expect(toggleColumnVisibility(visibility, "age", all)).toEqual({ age: true });
    expect(visibility).toEqual({ age: false });
  });

  it("a hidden non-hideable column can be shown again", () => {
    expect(toggleColumnVisibility({ actions: false }, "actions", all)).toEqual({ actions: true });
  });
});
