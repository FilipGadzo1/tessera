/** A page number, or a gap of hidden pages before/after the sibling window. */
export type PaginationRangeItem = number | "ellipsis-start" | "ellipsis-end";

export interface PaginationRangeOptions {
  /** The current 1-based page. */
  page: number;
  /** Total number of pages. */
  pageCount: number;
  /** Pages shown on each side of `page`. @default 1 */
  siblings?: number;
  /** Pages always shown at each end. @default 1 */
  boundaries?: number;
}

function range(start: number, end: number): number[] {
  if (end < start) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

/**
 * Pure: the list of page numbers and ellipsis markers for a pager, e.g.
 * `1 … 4 5 [6] 7 8 … 20`. Never shows an ellipsis over a single hidden page — the page itself
 * takes its place instead, since collapsing one page saves no space.
 */
export function getPaginationRange({
  page,
  pageCount,
  siblings = 1,
  boundaries = 1,
}: PaginationRangeOptions): PaginationRangeItem[] {
  if (pageCount <= 0) return [];

  // Every page fits without a gap: boundaries on both ends + siblings on both ends + the
  // current page + the two ellipsis slots they'd otherwise occupy.
  const totalVisible = boundaries * 2 + siblings * 2 + 3;
  if (pageCount <= totalVisible) return range(1, pageCount);

  const current = Math.min(Math.max(page, 1), pageCount);
  const leftSibling = Math.max(current - siblings, boundaries + 1);
  const rightSibling = Math.min(current + siblings, pageCount - boundaries);

  // A gap of exactly one page (e.g. boundary=1, leftSibling=3) shows that page instead of an
  // ellipsis: collapsing a single page saves no space.
  const showLeftEllipsis = leftSibling > boundaries + 2;
  const showRightEllipsis = rightSibling < pageCount - boundaries - 1;

  return [
    ...range(1, boundaries),
    ...(showLeftEllipsis ? (["ellipsis-start"] as const) : range(boundaries + 1, leftSibling - 1)),
    ...range(leftSibling, rightSibling),
    ...(showRightEllipsis
      ? (["ellipsis-end"] as const)
      : range(rightSibling + 1, pageCount - boundaries)),
    ...range(pageCount - boundaries + 1, pageCount),
  ];
}
