import { type ComponentProps, cloneElement, type ReactElement } from "react";
import { cn } from "../../lib/cn";
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
  /** No `href`; `aria-disabled` + `data-disabled` instead, so it stays out of the tab order. */
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

/** A single page link, styled like an outline (active) or ghost (inactive) icon Button. */
export function PaginationLink({
  isActive,
  disabled,
  size = "icon",
  render,
  className,
  href,
  "data-slot": dataSlot = "pagination-link",
  ...props
}: PaginationLinkProps) {
  const classes = buttonVariants({
    variant: isActive ? "outline" : "ghost",
    color: "neutral",
    size,
    className,
  });
  const shared = {
    ...props,
    ...(isActive && { "aria-current": "page" as const }),
    ...(disabled ? { "aria-disabled": "true" as const, "data-disabled": "" } : { href }),
    "data-slot": dataSlot,
  };
  if (render) {
    return cloneElement(render, {
      ...shared,
      ...render.props,
      className: cn(classes, render.props.className),
    });
  }
  return <a {...shared} className={classes} />;
}

export type PaginationPreviousProps = Omit<PaginationLinkProps, "size" | "isActive">;

function ChevronLeftIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** A `PaginationLink` widened for a leading chevron and "Previous" text (hidden below `sm:`). */
export function PaginationPrevious({ className, ...props }: PaginationPreviousProps) {
  return (
    <PaginationLink
      {...props}
      aria-label="Go to previous page"
      data-slot="pagination-previous"
      size="md"
      className={cn("gap-1.5", className)}
    >
      <ChevronLeftIcon />
      <span className="hidden sm:inline">Previous</span>
    </PaginationLink>
  );
}

export type PaginationNextProps = PaginationPreviousProps;

/** A `PaginationLink` widened for a trailing chevron and "Next" text (hidden below `sm:`). */
export function PaginationNext({ className, ...props }: PaginationNextProps) {
  return (
    <PaginationLink
      {...props}
      aria-label="Go to next page"
      data-slot="pagination-next"
      size="md"
      className={cn("gap-1.5", className)}
    >
      <span className="hidden sm:inline">Next</span>
      <ChevronRightIcon />
    </PaginationLink>
  );
}

function EllipsisIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-4">
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
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
      <EllipsisIcon />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export {
  getPaginationRange,
  type PaginationRangeItem,
  type PaginationRangeOptions,
} from "./pagination-range";
