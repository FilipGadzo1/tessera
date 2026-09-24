import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

/** Defaults — shared by cva and the TabsList's `data-variant`. */
export const tabsDefaults = { variant: "underline" } as const;

/*
 * Vertical orientation is styled from Base UI's `data-orientation` attribute (set on every part by
 * the Tabs root), so one variant string covers both orientations.
 */
const tabsListCva = cva("", {
  variants: {
    variant: {
      underline: [
        "relative flex gap-4 border-b border-border",
        "data-[orientation=vertical]:flex-col data-[orientation=vertical]:gap-1 data-[orientation=vertical]:border-b-0 data-[orientation=vertical]:border-l",
      ],
      segmented: [
        "inline-flex h-10 items-center rounded-lg bg-muted p-1",
        "data-[orientation=vertical]:h-auto data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch data-[orientation=vertical]:self-start",
      ],
    },
  },
  defaultVariants: tabsDefaults,
});

const tabFocus =
  "outline-hidden outline-offset-2 outline-ring focus-visible:outline-2 focus-visible:outline-solid";

const tabsTabCva = cva("", {
  variants: {
    variant: {
      underline: [
        "relative -mb-px inline-flex h-10 cursor-pointer items-center gap-2 px-1 text-sm font-medium text-muted-foreground transition-colors not-data-disabled:hover:text-foreground data-active:text-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50",
        tabFocus,
        "data-[orientation=vertical]:mb-0 data-[orientation=vertical]:px-3",
      ],
      segmented: [
        "inline-flex h-full flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground not-data-disabled:hover:text-foreground data-active:bg-background data-active:text-foreground data-active:shadow-xs data-disabled:cursor-not-allowed data-disabled:opacity-50",
        tabFocus,
        "data-[orientation=vertical]:h-8 data-[orientation=vertical]:flex-none data-[orientation=vertical]:justify-start",
      ],
    },
  },
  defaultVariants: tabsDefaults,
});

export type TabsVariantProps = VariantProps<typeof tabsListCva>;
export type TabsVariant = NonNullable<TabsVariantProps["variant"]>;

/** TabsList classes for a variant. Server-safe. */
export function tabsListVariants(options: TabsVariantProps & { className?: string } = {}): string {
  const { className, ...variants } = options;
  return cn(tabsListCva(variants), className);
}

/** TabsTab classes for a variant. Server-safe. */
export function tabsTabVariants(options: TabsVariantProps & { className?: string } = {}): string {
  const { className, ...variants } = options;
  return cn(tabsTabCva(variants), className);
}

/** The underline variant's sliding indicator (Base UI sets the `--active-tab-*` vars). */
export const tabsIndicatorClasses = cn(
  "absolute bottom-0 left-(--active-tab-left) h-0.5 w-(--active-tab-width) rounded-full bg-primary transition-[left,width] duration-200 ease-out motion-reduce:transition-none",
  "data-[orientation=vertical]:top-(--active-tab-top) data-[orientation=vertical]:bottom-auto data-[orientation=vertical]:left-0 data-[orientation=vertical]:h-(--active-tab-height) data-[orientation=vertical]:w-0.5 data-[orientation=vertical]:transition-[top,height]",
);

/** Tabs root: side by side (list, then panel) when vertical. */
export const tabsRootClasses = "data-[orientation=vertical]:flex data-[orientation=vertical]:gap-6";

export const tabsPanelClasses = cn(
  "outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring pt-4",
  "data-[orientation=vertical]:min-w-0 data-[orientation=vertical]:flex-1 data-[orientation=vertical]:pt-0",
);
