import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

/** Defaults — shared by cva and the Toggle's / ToggleGroup's data attributes. */
export const toggleDefaults = { variant: "ghost", size: "md" } as const;

/**
 * The shared focus ring for controls without a text-field border (Toggle, ToolbarLink, and —
 * later — Calendar's day buttons): 2px solid, offset, the tone ring colour.
 */
export const toggleFocusClasses =
  "outline-none outline-offset-2 outline-ring focus-visible:outline-2 focus-visible:outline-solid";

const toggleCva = cva(
  [
    "inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap",
    "transition-[color,background-color,border-color,outline-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
    toggleFocusClasses,
    "data-disabled:cursor-not-allowed data-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "text-muted-foreground not-data-disabled:hover:bg-muted not-data-disabled:hover:text-foreground",
    "data-pressed:bg-accent data-pressed:text-accent-foreground",
    "forced-colors:data-pressed:bg-[Highlight] forced-colors:data-pressed:text-[HighlightText]",
    "forced-colors:not-data-disabled:hover:data-pressed:bg-[Highlight] forced-colors:not-data-disabled:hover:data-pressed:text-[HighlightText]",
  ],
  {
    variants: {
      variant: {
        ghost: "",
        // *Amended in Task 2*: the spec's base string doesn't include a forced-colors
        // focus-visible outline; the outline variant needs one because its idle border
        // (`border-field-border`) is forced to `CanvasText` — the same colour Windows High
        // Contrast forces `outline-ring` to — so a focused-but-unpressed outline toggle would
        // show no visible ring change. Verified by the "outline variant keeps a forced-colors
        // focus outline" test (toggle.test.tsx), which asserts the resolved outline colour is
        // `Highlight`, distinct from the idle `CanvasText` border.
        outline:
          "border border-field-border bg-transparent forced-colors:focus-visible:outline-[Highlight]",
      },
      size: {
        sm: "h-8 px-2.5 min-w-8",
        md: "h-10 px-3 min-w-10",
        lg: "h-12 px-4 min-w-12",
        "icon-sm": "size-8",
        icon: "size-10",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: toggleDefaults,
  },
);

export type ToggleVariantProps = VariantProps<typeof toggleCva>;

/** Toggle classes for any element. */
export function toggleVariants(options: ToggleVariantProps & { className?: string } = {}): string {
  const { className, ...variants } = options;
  return cn(toggleCva(variants), className);
}
