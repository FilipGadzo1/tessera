import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { backdropMotion, dialogMotion } from "../../lib/overlay-classes";

/** Defaults — shared by cva and the dialog popup's `data-size`. */
export const dialogDefaults = { size: "md" } as const;

/*
 * The popup is capped at the viewport height (1rem margin top and bottom) and scrolls inside:
 * it is centred with `fixed` + translate, so without the cap long content would overflow both
 * viewport edges and its top (title, first fields) could not be reached while scroll is locked.
 */
const dialogCva = cva(
  [
    "fixed left-1/2 top-1/2 z-(--z-overlay) -translate-x-1/2 -translate-y-1/2 grid w-[calc(100%-2rem)] gap-4 rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-xl outline-hidden",
    "max-h-[calc(100dvh-2rem)] overflow-y-auto",
    dialogMotion,
  ],
  {
    variants: {
      size: {
        sm: "max-w-sm",
        md: "max-w-lg",
        lg: "max-w-2xl",
      },
    },
    defaultVariants: dialogDefaults,
  },
);

export type DialogVariantProps = VariantProps<typeof dialogCva>;

/** Dialog popup classes (shared by Dialog and AlertDialog). Server-safe. */
export function dialogVariants(options: DialogVariantProps & { className?: string } = {}): string {
  const { className, ...variants } = options;
  return cn(dialogCva(variants), className);
}

/** Backdrop classes (shared by Dialog and AlertDialog). */
export const dialogBackdropClasses = cn(
  "fixed inset-0 z-(--z-overlay) bg-black/50",
  backdropMotion,
);

/** Text and layout part classes (shared by Dialog and AlertDialog). */
export const dialogHeaderClasses = "flex flex-col gap-1.5";
export const dialogFooterClasses = "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end";
export const dialogTitleClasses = "text-lg font-semibold leading-snug";
export const dialogDescriptionClasses = "text-sm text-muted-foreground";
