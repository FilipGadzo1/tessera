import { type ComponentProps, cloneElement, type ReactElement, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface BreadcrumbProps extends ComponentProps<"nav"> {
  /** @default "Breadcrumb" */
  "aria-label"?: string;
}

/** The `nav` landmark wrapping a `BreadcrumbList`. Server-safe. */
export function Breadcrumb({ "aria-label": ariaLabel = "Breadcrumb", ...props }: BreadcrumbProps) {
  return <nav {...props} aria-label={ariaLabel} data-slot="breadcrumb" />;
}

export type BreadcrumbListProps = ComponentProps<"ol">;

/** The ordered list of `BreadcrumbItem`s. */
export function BreadcrumbList({ className, ...props }: BreadcrumbListProps) {
  return (
    <ol
      {...props}
      data-slot="breadcrumb-list"
      className={cn("flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground", className)}
    />
  );
}

export type BreadcrumbItemProps = ComponentProps<"li">;

/** One crumb: a `BreadcrumbLink` or the current `BreadcrumbPage`. */
export function BreadcrumbItem({ className, ...props }: BreadcrumbItemProps) {
  return (
    <li
      {...props}
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1.5", className)}
    />
  );
}

export interface BreadcrumbLinkProps extends ComponentProps<"a"> {
  /**
   * Renders the given element instead of `<a>` (e.g. a router `Link`), cloning these props onto
   * it. Kept server-safe by cloning rather than using Base UI's `useRender` (a hook).
   */
  render?: ReactElement<{ className?: string } & Record<string, unknown>>;
  "data-slot"?: string;
}

const breadcrumbLinkClasses =
  "rounded-sm transition-colors hover:text-foreground outline-none outline-offset-2 outline-ring focus-visible:outline-2 focus-visible:outline-solid cursor-pointer";

/** A clickable crumb. Pass `render={<Link to="…" />}` to use a router link instead of `<a>`. */
export function BreadcrumbLink({
  render,
  className,
  "data-slot": dataSlot = "breadcrumb-link",
  ...props
}: BreadcrumbLinkProps) {
  const classes = cn(breadcrumbLinkClasses, className);
  if (render) {
    return cloneElement(render, {
      ...props,
      ...render.props,
      "data-slot": dataSlot,
      className: cn(classes, render.props.className),
    });
  }
  return <a {...props} data-slot={dataSlot} className={classes} />;
}

export type BreadcrumbPageProps = ComponentProps<"span">;

/** The current page: not a link, named for assistive technology via `aria-current="page"`. */
export function BreadcrumbPage({ className, ...props }: BreadcrumbPageProps) {
  return (
    <span
      {...props}
      aria-current="page"
      data-slot="breadcrumb-page"
      className={cn("font-medium text-foreground", className)}
    />
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export interface BreadcrumbSeparatorProps extends ComponentProps<"li"> {
  children?: ReactNode;
}

/** Hidden from assistive technology; defaults to a chevron, override with `children`. */
export function BreadcrumbSeparator({ children, ...props }: BreadcrumbSeparatorProps) {
  return (
    <li {...props} role="presentation" aria-hidden="true" data-slot="breadcrumb-separator">
      {children ?? <ChevronRightIcon className="size-3.5" />}
    </li>
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

export type BreadcrumbEllipsisProps = ComponentProps<"span">;

/**
 * A collapsed run of crumbs. Hidden from assistive technology, with visually-hidden "More" text.
 * Wrap it in a `MenuTrigger` to let it expand the hidden crumbs.
 */
export function BreadcrumbEllipsis({ className, ...props }: BreadcrumbEllipsisProps) {
  return (
    <span
      {...props}
      role="presentation"
      aria-hidden="true"
      data-slot="breadcrumb-ellipsis"
      className={cn("flex size-9 items-center justify-center", className)}
    >
      <EllipsisIcon />
      <span className="sr-only">More</span>
    </span>
  );
}
