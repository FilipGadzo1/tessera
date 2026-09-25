import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { backdropMotion } from "../../lib/overlay-classes";

/** Defaults — shared by cva, the Drawer root and the popup's `data-side`. */
export const drawerDefaults = { side: "right" } as const;

/*
 * The popup follows the pointer through Base UI's swipe vars: `--drawer-swipe-movement-x/y` hold
 * the drag offset (set inline on the popup; 0px at rest). They drive `transform`, not Tailwind's
 * `translate` property, because while a swipe is in progress Base UI writes the drag offset to the
 * inline `transform` itself (`useSwipeDismiss`): the inline value replaces the class `transform`
 * instead of adding to it, so the popup never moves twice as far as the pointer. After release the
 * var keeps the last offset, so the exit slide (`translate` 100% on `data-ending-style`) starts from
 * where the pointer let go. While swiping Base UI sets `data-swiping`: no transition then.
 */
const drawerCva = cva(
  [
    "fixed z-(--z-overlay) flex flex-col gap-4 border-border bg-popover text-popover-foreground shadow-xl outline-hidden",
    "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-swiping:transition-none motion-reduce:transition-none",
  ],
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 h-full w-3/4 max-w-sm border-l transform-[translateX(var(--drawer-swipe-movement-x))] data-starting-style:translate-x-full data-ending-style:translate-x-full",
        left: "inset-y-0 left-0 h-full w-3/4 max-w-sm border-r transform-[translateX(var(--drawer-swipe-movement-x))] data-starting-style:-translate-x-full data-ending-style:-translate-x-full",
        bottom:
          "inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl border-t transform-[translateY(var(--drawer-swipe-movement-y))] data-starting-style:translate-y-full data-ending-style:translate-y-full",
        top: "inset-x-0 top-0 max-h-[85vh] rounded-b-xl border-b transform-[translateY(var(--drawer-swipe-movement-y))] data-starting-style:-translate-y-full data-ending-style:-translate-y-full",
      },
    },
    defaultVariants: drawerDefaults,
  },
);

export type DrawerVariantProps = VariantProps<typeof drawerCva>;

/** Drawer popup classes for a `side`. Server-safe. */
export function drawerVariants(options: DrawerVariantProps & { className?: string } = {}): string {
  const { className, ...variants } = options;
  return cn(drawerCva(variants), className);
}

/**
 * Backdrop: Dialog's, plus it fades with the swipe (`--drawer-swipe-progress`, 0 → 1 as the popup
 * is dragged towards dismissal, set inline by Base UI) and does not lag behind the pointer while
 * Base UI marks it `data-swiping`.
 */
export const drawerBackdropClasses = cn(
  "fixed inset-0 z-(--z-overlay) bg-black/50",
  backdropMotion,
  "opacity-[calc(1-var(--drawer-swipe-progress))] data-swiping:transition-none",
);

/** Grab handle shown at the top of bottom drawers. */
export const drawerHandleClasses = "mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-muted";

/**
 * Layout part classes. Title and description reuse Dialog's. The header's `pr-12` keeps a wrapping
 * title or description clear of the close button (`right-4` + `size-8` = 3rem).
 */
export const drawerHeaderClasses = "flex flex-col gap-1.5 p-4 pr-12";
export const drawerFooterClasses =
  "mt-auto flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end";
