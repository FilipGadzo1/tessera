import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

/** Defaults — shared by cva and the input group's data attributes. */
export const comboboxDefaults = { size: "md" } as const;

/*
 * The input group and the chips container both wear the `textFieldBase` look, but focus lives on
 * the `<input>` inside them, so the ring uses `focus-within`. Written out directly rather than
 * derived from `textFieldBase` by string surgery (see `number-field-variants.ts`). As in the
 * NumberField group, the transition list drops `outline-color`: a transitioning `:focus-within`
 * ring is visibly mid-interpolation right after Tab (Phase E spec, *Amended in Task 4*).
 */

/**
 * Input group (`Combobox.InputGroup`): Base UI gives it the Field / combobox `state`, so it keys off
 * `data-invalid` / `data-disabled` / `data-readonly`. `has-aria-invalid:` covers an `aria-invalid`
 * set directly on the input without a `Field` (the Input parity of `textFieldBase`).
 */
export const comboboxInputGroupBase: string[] = [
  "inline-flex w-full min-w-0 items-stretch overflow-hidden rounded-md border border-field-border bg-field text-foreground shadow-xs",
  "not-data-disabled:not-data-invalid:not-has-aria-invalid:not-focus-within:hover:border-field-border-hover",
  "outline-none focus-within:outline-1 focus-within:outline-solid focus-within:outline-ring focus-within:border-ring forced-colors:focus-within:outline-[Highlight]",
  "data-invalid:border-danger data-invalid:focus-within:outline-danger has-aria-invalid:border-danger has-aria-invalid:focus-within:outline-danger",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50 data-readonly:bg-muted",
  "transition-[color,background-color,border-color,box-shadow,translate] duration-150 ease-out motion-reduce:transition-none",
];

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

const comboboxInputGroupCva = cva(comboboxInputGroupBase, {
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
