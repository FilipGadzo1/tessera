import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

/** Defaults — shared by cva and the Group's data attributes. */
export const numberFieldDefaults = { size: "md" } as const;

/**
 * Group classes: the `textFieldBase` look adapted for a non-input container. Written out directly
 * rather than derived from `textFieldBase` by string surgery (the Select trigger's `.replace()`
 * derivation — see `select-variants.ts` — is a known backlog weakness this avoids):
 * - Focus lives on the child `NumberFieldInput`, so the ring uses `focus-within` instead of `focus`.
 * - The group is a `<div role="group">`, which never matches `:read-only`/`:disabled`/`:invalid`
 *   (only editable form elements do), so it keys off Base UI's `data-readonly` / `data-disabled` /
 *   `data-invalid` instead of the pseudo-classes `textFieldBase` uses for the native `<input>`.
 */
export const numberFieldGroupBase: string[] = [
  "inline-flex w-full min-w-0 items-stretch overflow-hidden rounded-md border border-field-border bg-field text-foreground shadow-xs",
  "not-data-disabled:not-data-invalid:not-focus-within:hover:border-field-border-hover",
  "outline-none focus-within:outline-1 focus-within:outline-solid focus-within:outline-ring focus-within:border-ring forced-colors:focus-within:outline-[Highlight]",
  "data-invalid:border-danger data-invalid:focus-within:outline-danger",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50 data-readonly:bg-muted",
  // No `outline-color` here (unlike `textFieldBase`'s transition list) — *Amended in Task 4*, see
  // the spec doc for the evidence: transitioning `outline-color` on a `:focus-within` ring (an
  // ancestor of the element that actually receives focus) leaves the ring interpolating from its
  // pre-focus value; a synchronous read of the ring's colour right after the focus change catches
  // it mid-transition instead of at the target colour, unlike a `:focus` ring on the focused
  // element itself (Input, Select trigger), which reflects the target colour immediately. Dropping
  // `outline-color` from the transition list makes the ring colour snap, avoiding both the flaky
  // read and — for real users — a momentary wrong-colour flash of the ring itself.
  "transition-[color,background-color,border-color,box-shadow,translate] duration-150 ease-out motion-reduce:transition-none",
];

/**
 * Height and text size per `size`, matching `textFieldSizes` (Input, Select trigger) minus the
 * horizontal padding: the group is edge-to-edge (`NumberFieldInput` carries its own `px-3`, and the
 * stepper buttons are `aspect-square h-full`), so group-level padding would push the buttons in
 * from the border instead of letting them fill the full height.
 */
export const numberFieldGroupSizes = {
  sm: "h-8 text-sm",
  md: "h-10 text-sm",
  lg: "h-12 text-base",
} as const;

const numberFieldGroupCva = cva(numberFieldGroupBase, {
  variants: { size: numberFieldGroupSizes },
  defaultVariants: numberFieldDefaults,
});

export type NumberFieldGroupVariantProps = VariantProps<typeof numberFieldGroupCva>;

/** NumberField group classes for any element. */
export function numberFieldGroupVariants(
  options: NumberFieldGroupVariantProps & { className?: string } = {},
): string {
  const { className, ...variants } = options;
  return cn(numberFieldGroupCva(variants), className);
}
