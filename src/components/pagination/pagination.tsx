import type { ComponentProps, ReactElement } from "react";
import { cloneRender } from "../../lib/clone-render";
import { cn } from "../../lib/cn";
import { ChevronLeftIcon, ChevronRightIcon, EllipsisIcon } from "../../lib/icons";
import { type ButtonVariantProps, buttonVariants } from "../button/button-variants";

export interface PaginationProps extends ComponentProps<"nav"> {
  /** @default "Pagination" */
  "aria-label"?: string;
}

/** The `nav` landmark wrapping a `PaginationContent`. Server-safe. */
export function Pagination({
  "aria-label": ariaLabel = "Pagination",
  className,
  ...props
}: PaginationProps) {
  return (
    <nav
      {...props}
      aria-label={ariaLabel}
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
    />
  );
}

export type PaginationContentProps = ComponentProps<"ul">;

/** The list of `PaginationItem`s. */
export function PaginationContent({ className, ...props }: PaginationContentProps) {
  return (
    <ul
      {...props}
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
    />
  );
}

export type PaginationItemProps = ComponentProps<"li">;

/** One item in the pager: a page link, ellipsis, or previous/next control. */
export function PaginationItem(props: PaginationItemProps) {
  return <li {...props} data-slot="pagination-item" />;
}

export interface PaginationLinkProps extends ComponentProps<"a"> {
  /** Marks this as the current page (`aria-current="page"`, outline styling). */
  isActive?: boolean;
  /**
   * Non-interactive: `aria-disabled` + `data-disabled` (dimmed), no `href` and no `onClick`, so it
   * stays out of the tab order and ignores clicks. A `render` element (e.g. a `<button>`) also gets
   * `tabIndex={-1}` and loses its own `href` / `onClick`; it keeps focus if it disables while
   * focused (no native `disabled`, which would drop focus to the page).
   */
  disabled?: boolean;
  /** @default "icon" */
  size?: ButtonVariantProps["size"];
  /**
   * Renders the given element instead of `<a>` (e.g. a router `Link` or a `<button>`), cloning
   * these props onto it. Kept server-safe by cloning rather than using Base UI's `useRender`.
   */
  render?: ReactElement<{ className?: string } & Record<string, unknown>>;
  "data-slot"?: string;
}

/**
 * In forced colors the outline/ghost difference disappears (author borders and backgrounds are
 * replaced), so the active page takes the system "selected" pairing, as the active segmented tab
 * does, on hover too: the variant's hover background and text colours would otherwise be forced
 * to Canvas and the link colour.
 */
const activeForcedColorsClasses =
  "forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:not-data-disabled:hover:bg-[Highlight] forced-colors:not-data-disabled:hover:text-[HighlightText]";

/** A single page link, styled like an outline (active) or ghost (inactive) icon Button. */
export function PaginationLink({
  isActive,
  disabled,
  size = "icon",
  render,
  className,
  href,
  onClick,
  "data-slot": dataSlot = "pagination-link",
  ...props
}: PaginationLinkProps) {
  const classes = buttonVariants({
    variant: isActive ? "outline" : "ghost",
    color: "neutral",
    size,
    className: cn(isActive && activeForcedColorsClasses, className),
  });
  const shared = {
    ...props,
    ...(isActive && { "aria-current": "page" as const }),
    ...(disabled ? { "aria-disabled": "true" as const, "data-disabled": "" } : { href, onClick }),
  };
  if (render) {
    return cloneRender(render, shared, {
      slot: dataSlot,
      className: classes,
      // A disabled clone must not stay interactive through the render element's own props either.
      // `tabIndex={-1}` rather than a `<button>`'s native `disabled`: that would blur a focused
      // Next the moment it disables on the last page, dropping a keyboard user's place.
      overrideProps: disabled ? { onClick: undefined, href: undefined, tabIndex: -1 } : undefined,
    });
  }
  return <a {...shared} data-slot={dataSlot} className={classes} />;
}

export type PaginationPreviousProps = Omit<PaginationLinkProps, "size" | "isActive">;

/**
 * A `PaginationLink` widened for a leading chevron and "Previous" text (hidden below `sm:`).
 * `children` replaces the visible text and `aria-label` the accessible name ("Go to previous
 * page"); localise both.
 */
export function PaginationPrevious({
  className,
  children = "Previous",
  "aria-label": ariaLabel = "Go to previous page",
  ...props
}: PaginationPreviousProps) {
  return (
    <PaginationLink
      {...props}
      aria-label={ariaLabel}
      data-slot="pagination-previous"
      size="md"
      className={cn("gap-1.5", className)}
    >
      <ChevronLeftIcon className="size-4" />
      <span className="hidden sm:inline">{children}</span>
    </PaginationLink>
  );
}

export type PaginationNextProps = PaginationPreviousProps;

/**
 * A `PaginationLink` widened for a trailing chevron and "Next" text (hidden below `sm:`).
 * `children` replaces the visible text and `aria-label` the accessible name ("Go to next page");
 * localise both.
 */
export function PaginationNext({
  className,
  children = "Next",
  "aria-label": ariaLabel = "Go to next page",
  ...props
}: PaginationNextProps) {
  return (
    <PaginationLink
      {...props}
      aria-label={ariaLabel}
      data-slot="pagination-next"
      size="md"
      className={cn("gap-1.5", className)}
    >
      <span className="hidden sm:inline">{children}</span>
      <ChevronRightIcon className="size-4" />
    </PaginationLink>
  );
}

export type PaginationEllipsisProps = ComponentProps<"span">;

/** A collapsed run of pages. Hidden from assistive technology, with visually-hidden text. */
export function PaginationEllipsis({ className, ...props }: PaginationEllipsisProps) {
  return (
    <span
      {...props}
      aria-hidden="true"
      data-slot="pagination-ellipsis"
      className={cn("flex size-10 items-center justify-center", className)}
    >
      <EllipsisIcon className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export {
  getPaginationRange,
  type PaginationRangeItem,
  type PaginationRangeOptions,
} from "./pagination-range";
