import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { toggleFocusClasses } from "../../lib/focus-classes";

/*
 * Server-safe class strings for the Sidebar family. Parts read the sidebar's state through the
 * `group/sidebar` element (the desktop `aside`, or the mobile drawer's inner wrapper):
 * `data-state` (expanded / collapsed), `data-collapsible` (icon / offcanvas, set only while
 * collapsed), `data-variant` and `data-side`.
 */

/** Defaults shared by the Sidebar root and its data attributes. */
export const sidebarDefaults = {
  side: "left",
  variant: "sidebar",
  collapsible: "offcanvas",
} as const;

const widthMotion = "duration-200 ease-out motion-reduce:transition-none";

/**
 * The desktop column (`aside`): in the flex row of the provider's wrapper, stretched to the row's
 * height, clipping its panel while the width animates. Collapsed off-canvas it is 0 wide; in icon
 * mode it is `--sidebar-icon-extent` wide, the icon width plus the variant's own padding and
 * border, so the content area inside is exactly `--sidebar-width-icon`. A right sidebar goes last
 * in the row whatever its DOM position, and its panel is pinned to the right edge.
 */
export const sidebarColumnVariants = cva(
  [
    "group/sidebar hidden shrink-0 overflow-clip text-foreground md:flex",
    "w-(--sidebar-width) data-[collapsible=icon]:w-(--sidebar-icon-extent) data-[collapsible=offcanvas]:w-0",
    "data-[side=right]:order-last data-[side=right]:justify-end",
    `transition-[width] ${widthMotion}`,
  ],
  {
    variants: {
      variant: {
        sidebar: "[--sidebar-icon-extent:calc(var(--sidebar-width-icon)+1px)]",
        floating: "[--sidebar-icon-extent:calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]",
        inset: "[--sidebar-icon-extent:var(--sidebar-width-icon)]",
      },
    },
    defaultVariants: { variant: sidebarDefaults.variant },
  },
);

/**
 * The panel inside the column: sticky to the viewport top while the page scrolls, as tall as the
 * viewport (or the row, if that is shorter). Off-canvas it slides out towards its edge.
 */
export const sidebarContainerVariants = cva(
  [
    "sticky top-0 flex h-svh max-h-full w-(--sidebar-width) shrink-0 flex-col",
    "group-data-[collapsible=icon]/sidebar:w-(--sidebar-icon-extent)",
    // Towards the column's outer edge: the start for `left`, the end for `right` (mirrored in RTL).
    "group-data-[collapsible=offcanvas]/sidebar:group-data-[side=left]/sidebar:ltr:-translate-x-full",
    "group-data-[collapsible=offcanvas]/sidebar:group-data-[side=left]/sidebar:rtl:translate-x-full",
    "group-data-[collapsible=offcanvas]/sidebar:group-data-[side=right]/sidebar:ltr:translate-x-full",
    "group-data-[collapsible=offcanvas]/sidebar:group-data-[side=right]/sidebar:rtl:-translate-x-full",
    `transition-[width,translate] ${widthMotion}`,
  ],
  {
    variants: {
      variant: { sidebar: "", floating: "p-2", inset: "" },
    },
    defaultVariants: { variant: sidebarDefaults.variant },
  },
);

/** The sidebar's surface: a bordered column, a floating card, or transparent on the inset's backdrop. */
export const sidebarInnerVariants = cva("flex size-full min-h-0 flex-col", {
  variants: {
    variant: {
      sidebar:
        "border-border bg-card group-data-[side=left]/sidebar:border-e group-data-[side=right]/sidebar:border-s",
      floating: "rounded-lg border border-border bg-card shadow-sm",
      inset: "",
    },
  },
  defaultVariants: { variant: sidebarDefaults.variant },
});

/** `collapsible="none"`: a static column at every breakpoint. */
export const sidebarStaticClasses =
  "group/sidebar flex h-full w-(--sidebar-width) shrink-0 flex-col border-border bg-card text-foreground data-[side=left]:border-e data-[side=right]:border-s";

/**
 * The mobile drawer: Drawer's side panel, 18rem wide (at most 85% of the viewport), without its
 * gap and padding. A fixed width, not `--sidebar-width`: the drawer is portalled out of the
 * provider's wrapper, where that variable is set.
 */
export const sidebarMobileClasses = "w-72 max-w-[85vw] gap-0 bg-card p-0";

/** The provider's row. With an inset sidebar, the backdrop behind the inset card is the sidebar surface. */
export const sidebarWrapperClasses =
  "group/sidebar-wrapper flex min-h-svh w-full has-[[data-slot=sidebar][data-variant=inset]]:bg-card";

/** The main area; next to an inset sidebar it becomes a rounded, bordered card with a margin. */
export const sidebarInsetClasses = cn(
  "relative flex w-full min-w-0 flex-1 flex-col bg-background",
  "md:group-has-[[data-slot=sidebar][data-variant=inset]]/sidebar-wrapper:m-2",
  "md:group-has-[[data-slot=sidebar][data-variant=inset]]/sidebar-wrapper:rounded-xl",
  "md:group-has-[[data-slot=sidebar][data-variant=inset]]/sidebar-wrapper:border",
  "md:group-has-[[data-slot=sidebar][data-variant=inset]]/sidebar-wrapper:border-border",
  "md:group-has-[[data-slot=sidebar][data-variant=inset]]/sidebar-wrapper:shadow-sm",
);

/**
 * The rail's host: a zero-width flex item beside the column, on its inner edge, stretched to the
 * row's height. Not inside the clipped, possibly inert `aside`. A right sidebar's host is
 * `order-last` like the column, and comes before it in the DOM.
 */
export const sidebarRailHostClasses =
  "group/sidebar-rail relative z-20 hidden w-0 shrink-0 md:block data-[side=right]:order-last";

/**
 * The rail: an 8px pointer-only hit area just outside the column's inner edge (over the page's
 * edge, not the sidebar's buttons or scrollbar). A 2px line on the edge shows on hover. Placed
 * with logical insets from the host, so it extends towards the page in either direction: a
 * `left` column's host is after it (the rail starts there), a `right` one's before it (the rail
 * ends there). The resize cursors point along the physical edge (`data-edge`).
 */
export const sidebarRailClasses = cn(
  "absolute inset-y-0 flex w-2 cursor-pointer",
  "after:absolute after:inset-y-0 after:w-0.5 after:transition-[background-color] after:duration-150 motion-reduce:after:transition-none hover:after:bg-border forced-colors:hover:after:bg-[Highlight]",
  "group-data-[side=left]/sidebar-rail:start-0 group-data-[side=left]/sidebar-rail:after:start-0",
  "group-data-[side=right]/sidebar-rail:end-0 group-data-[side=right]/sidebar-rail:after:end-0",
  "group-data-[edge=left]/sidebar-rail:cursor-w-resize group-data-[edge=right]/sidebar-rail:cursor-e-resize",
  "group-data-[edge=left]/sidebar-rail:group-data-[state=collapsed]/sidebar-rail:cursor-e-resize",
  "group-data-[edge=right]/sidebar-rail:group-data-[state=collapsed]/sidebar-rail:cursor-w-resize",
);

/** Hidden while collapsed to icons. */
const hiddenInIcon = "group-data-[collapsible=icon]/sidebar:hidden";

/** Focus ring for every interactive part: 2px, inset so the scrolling content never clips it. */
const itemFocus = cn(
  toggleFocusClasses,
  "-outline-offset-2 forced-colors:focus-visible:outline-[Highlight]",
);

const itemMotion =
  "transition-[color,background-color,border-color,outline-color,box-shadow,translate] duration-150 ease-out motion-reduce:transition-none";

/* In the mobile Drawer the header clears Drawer's close button, which is physically `right-4` in
 * both directions, so the padding is physical too (`pe-12` put it on the wrong side under RTL). */
export const sidebarHeaderClasses =
  "flex flex-col gap-2 p-2 group-data-[mobile=true]/sidebar:pr-12";
export const sidebarFooterClasses = "flex flex-col gap-2 p-2";
export const sidebarContentClasses =
  "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]/sidebar:overflow-hidden";
export const sidebarSeparatorClasses =
  "mx-2 h-px w-auto shrink-0 bg-border forced-colors:bg-[CanvasText]";
export const sidebarGroupClasses = "relative flex w-full min-w-0 flex-col p-2";
export const sidebarGroupLabelClasses = cn(
  "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground",
  "[&>svg]:size-4 [&>svg]:shrink-0",
  itemFocus,
  hiddenInIcon,
);
export const sidebarGroupActionClasses = cn(
  "absolute end-3 top-3.5 flex aspect-square w-5 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground",
  "not-disabled:hover:bg-accent not-disabled:hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50",
  "after:absolute after:-inset-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
  itemMotion,
  itemFocus,
  hiddenInIcon,
);
export const sidebarGroupContentClasses = "w-full text-sm";

export const sidebarMenuClasses = "flex w-full min-w-0 flex-col gap-1";
export const sidebarMenuItemClasses = "group/menu-item relative";

/** Menu button sizes: sm 32px, md 36px, lg 48px (h-8 / h-9 / h-12). */
export const sidebarMenuButtonDefaults = { size: "md" } as const;

export const sidebarMenuButtonVariants = cva(
  [
    "peer/menu-button flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-md p-2 text-start text-sm text-foreground",
    itemMotion,
    itemFocus,
    "not-disabled:not-aria-disabled:hover:bg-accent not-disabled:not-aria-disabled:hover:text-accent-foreground",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    "data-active:bg-accent data-active:font-medium data-active:text-accent-foreground",
    "forced-colors:data-active:bg-[Highlight] forced-colors:data-active:text-[HighlightText] forced-colors:data-active:forced-color-adjust-none",
    // The ring is inset, inside the Highlight fill of an active item: paint it HighlightText there.
    "forced-colors:data-active:focus-visible:outline-[HighlightText]",
    "group-has-data-[slot=sidebar-menu-action]/menu-item:pe-8",
    "[&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
    // Icon mode: a 32px square. The label (the last child span) stays in the accessible name but
    // is visually hidden; a leading icon or avatar stays visible.
    "group-data-[collapsible=icon]/sidebar:size-8! group-data-[collapsible=icon]/sidebar:p-2! group-data-[collapsible=icon]/sidebar:[&>span:last-child]:sr-only",
  ],
  {
    variants: {
      size: {
        sm: "h-8",
        md: "h-9",
        lg: "h-12 group-data-[collapsible=icon]/sidebar:p-0!",
      },
    },
    defaultVariants: sidebarMenuButtonDefaults,
  },
);

export type SidebarMenuButtonVariantProps = VariantProps<typeof sidebarMenuButtonVariants>;

export const sidebarMenuActionClasses = cn(
  "absolute end-1 top-1.5 flex aspect-square w-6 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground",
  "not-disabled:hover:bg-accent not-disabled:hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50",
  "after:absolute after:-inset-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
  itemMotion,
  itemFocus,
  hiddenInIcon,
);

export const sidebarMenuBadgeClasses = cn(
  "pointer-events-none absolute end-1 top-1/2 flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-muted-foreground select-none",
  "peer-data-active/menu-button:text-accent-foreground",
  hiddenInIcon,
);

export const sidebarMenuSubClasses = cn(
  "ms-3.5 flex min-w-0 flex-col gap-1 border-s border-border ps-2.5 pe-0 py-0.5 forced-colors:border-[CanvasText]",
  hiddenInIcon,
);
export const sidebarMenuSubItemClasses = "group/menu-sub-item relative";
export const sidebarMenuSubButtonClasses = cn(
  "flex h-7 min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-foreground",
  itemMotion,
  itemFocus,
  "hover:bg-accent hover:text-accent-foreground",
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
  "data-active:bg-accent data-active:font-medium data-active:text-accent-foreground",
  "forced-colors:data-active:bg-[Highlight] forced-colors:data-active:text-[HighlightText] forced-colors:data-active:forced-color-adjust-none",
  "forced-colors:data-active:focus-visible:outline-[HighlightText]",
  "[&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
);

export const sidebarMenuSkeletonClasses = "flex h-9 items-center gap-2 rounded-md px-2";

/** The trigger's forced-colors focus ring, added to the ghost icon Button look. */
export const sidebarTriggerClasses = "forced-colors:focus-visible:outline-[Highlight]";
