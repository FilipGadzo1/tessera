import { describe, expect, it } from "vitest";
import { getPaginationRange } from "./pagination-range";

describe("getPaginationRange", () => {
  it("is empty for pageCount 0", () => {
    expect(getPaginationRange({ page: 1, pageCount: 0 })).toEqual([]);
  });

  it("is a single page for pageCount 1", () => {
    expect(getPaginationRange({ page: 1, pageCount: 1 })).toEqual([1]);
  });

  it("lists every page when they all fit without a gap", () => {
    expect(getPaginationRange({ page: 4, pageCount: 7 })).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it.each([
    [1, [1, 2, "ellipsis-end", 20]],
    [2, [1, 2, 3, "ellipsis-end", 20]],
    [20, [1, "ellipsis-start", 19, 20]],
    [19, [1, "ellipsis-start", 18, 19, 20]],
  ] as const)("page %s of 20 (default siblings/boundaries)", (page, expected) => {
    expect(getPaginationRange({ page, pageCount: 20 })).toEqual(expected);
  });

  it("shows the page instead of an ellipsis when the left gap is exactly one page", () => {
    // boundary [1], gap of exactly page 2, siblings [3,4,5], ellipsis, boundary [8].
    expect(getPaginationRange({ page: 4, pageCount: 8 })).toEqual([
      1,
      2,
      3,
      4,
      5,
      "ellipsis-end",
      8,
    ]);
  });

  it("shows the page instead of an ellipsis when the right gap is exactly one page", () => {
    expect(getPaginationRange({ page: 5, pageCount: 8 })).toEqual([
      1,
      "ellipsis-start",
      4,
      5,
      6,
      7,
      8,
    ]);
  });

  it("shows both ellipses in the middle of a long range", () => {
    expect(getPaginationRange({ page: 10, pageCount: 20 })).toEqual([
      1,
      "ellipsis-start",
      9,
      10,
      11,
      "ellipsis-end",
      20,
    ]);
  });

  it("clamps a page outside 1..pageCount", () => {
    expect(getPaginationRange({ page: 0, pageCount: 20 })).toEqual(
      getPaginationRange({ page: 1, pageCount: 20 }),
    );
    expect(getPaginationRange({ page: 99, pageCount: 20 })).toEqual(
      getPaginationRange({ page: 20, pageCount: 20 }),
    );
  });

  it("honours custom siblings and boundaries", () => {
    expect(getPaginationRange({ page: 3, pageCount: 6, siblings: 0, boundaries: 1 })).toEqual([
      1,
      2,
      3,
      "ellipsis-end",
      6,
    ]);
    expect(getPaginationRange({ page: 10, pageCount: 20, siblings: 2, boundaries: 2 })).toEqual([
      1,
      2,
      "ellipsis-start",
      8,
      9,
      10,
      11,
      12,
      "ellipsis-end",
      19,
      20,
    ]);
  });
});
