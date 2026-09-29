import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { textFieldGroupBase } from "../input/input-variants";

/** Defaults — shared by cva and the input group's data attributes. */
export const comboboxDefaults = { size: "md" } as const;

/*
 * The input group and the chips container both wear the `textFieldBase` look, but focus lives on
 * the `<input>` inside them, so the ring uses `focus-within`; the transition list drops
 * `outline-color` (see `textFieldGroupBase` in `input-variants.ts`).
 */

/**
 * Height, inline padding and text size per `size`, matching `textFieldSizes` (Input, Select
 * trigger). The start padding equals Input's so the text lines up; the end padding is smaller
 * because the trigger / clear buttons carry their own.
 */
export const comboboxInputGroupSizes = {
  sm: "h-8 ps-2.5 pe-1 text-sm",
  md: "h-10 ps-3 pe-1.5 text-sm",
  lg: "h-12 ps-4 pe-2 text-base",
} as const;

const comboboxInputGroupCva = cva(textFieldGroupBase, {
  variants: { size: comboboxInputGroupSizes },
  defaultVariants: comboboxDefaults,
});

export type ComboboxInputGroupVariantProps = VariantProps<typeof comboboxInputGroupCva>;

/** Combobox input group classes (the Input look around the input and its buttons) for any element. */
export function comboboxInputGroupVariants(
  options: ComboboxInputGroupVariantProps & { className?: string } = {},
): string {
  const { className, ...variants } = options;
  return cn(comboboxInputGroupCva(variants), className);
}

/**
 * Chips container (`Combobox.Chips`, `multiple`). Base UI gives it no state attributes, so the
 * invalid / disabled / read-only looks key off the `<input>` inside it with `has-`.
 */
export const comboboxChipsBase: string[] = [
  "flex min-h-10 w-full min-w-0 flex-wrap items-center gap-1 rounded-md border border-field-border bg-field p-1 text-foreground text-sm shadow-xs",
  "not-has-[input:disabled]:not-has-aria-invalid:not-focus-within:hover:border-field-border-hover",
  "outline-none focus-within:outline-1 focus-within:outline-solid focus-within:outline-ring focus-within:border-ring forced-colors:focus-within:outline-[Highlight]",
  "has-aria-invalid:border-danger has-aria-invalid:focus-within:outline-danger",
  "has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50 has-[input:read-only]:bg-muted",
  "transition-[color,background-color,border-color,box-shadow,translate] duration-150 ease-out motion-reduce:transition-none",
];

/*
 * Class strings the Combobox and the Autocomplete parts share (same Base UI parts underneath).
 * Server-safe.
 */
export const comboboxInputBase =
  "min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed";
/* Trigger and clear: Base UI renders both with `tabIndex={-1}` (the input owns the keyboard), so
 * they are mouse-only and carry no focus ring. */
export const comboboxButtonBase =
  "flex shrink-0 cursor-pointer items-center justify-center rounded-sm px-1 text-muted-foreground outline-none not-data-disabled:hover:text-foreground data-disabled:cursor-not-allowed [&_svg]:size-4";
export const comboboxContentBase =
  "min-w-(--anchor-width) max-h-[min(var(--available-height),20rem)] overflow-y-auto p-1";
// A listbox must own options: while filtering leaves none, hide it (it stays in the DOM, so the
// input's `aria-controls` still resolves) and let `ComboboxEmpty` / `ComboboxStatus` speak.
export const comboboxListBase = "not-has-[[role=option]]:hidden";
// `empty:p-0`: Base UI always renders Empty / Status (live regions must exist before their text
// changes), so the padding collapses while they have nothing to say.
export const comboboxEmptyBase = "px-2 py-6 text-center text-sm text-muted-foreground empty:p-0";
export const comboboxStatusBase = "px-2 py-1.5 text-sm text-muted-foreground empty:p-0";
export const comboboxGroupLabelBase = "px-2 py-1.5 text-xs font-medium text-muted-foreground";
export const comboboxSeparatorBase = "-mx-1 my-1 h-px bg-border forced-colors:bg-[CanvasText]";
