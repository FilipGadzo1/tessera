import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

/** Defaults — shared by cva and the Input's data attributes. */
export const inputDefaults = { size: "md" } as const;

/** Shared text-field classes (Input, Textarea): base, hover, focus, invalid, disabled, read-only, motion. */
export const textFieldBase: string[] = [
  "w-full min-w-0 rounded-md border border-field-border bg-field text-foreground shadow-xs placeholder:text-muted-foreground",
  "not-data-disabled:not-data-invalid:not-aria-invalid:not-focus:hover:border-field-border-hover",
  "outline-none focus:outline-1 focus:outline-solid focus:outline-ring focus:border-ring forced-colors:focus:outline-[Highlight]",
  "data-invalid:border-danger data-invalid:focus:outline-danger aria-invalid:border-danger aria-invalid:focus:outline-danger",
  "disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-muted",
  "transition-[color,background-color,border-color,outline-color,box-shadow,translate] duration-150 ease-out motion-reduce:transition-none",
];

/**
 * The `textFieldBase` look for a fixed-size, single-character slot (OTPField). Written out rather
 * than derived from `textFieldBase`: the slot drops `w-full min-w-0` (its width comes from the
 * `size-*` class) and is otherwise the same tokens, so keep the two in step.
 */
export const textFieldSlotBase: string[] = [
  "shrink-0 rounded-md border border-field-border bg-field p-0 text-foreground shadow-xs",
  "not-data-disabled:not-data-invalid:not-aria-invalid:not-focus:hover:border-field-border-hover",
  "outline-none focus:outline-1 focus:outline-solid focus:outline-ring focus:border-ring forced-colors:focus:outline-[Highlight]",
  "data-invalid:border-danger data-invalid:focus:outline-danger aria-invalid:border-danger aria-invalid:focus:outline-danger",
  "disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-muted",
  "transition-[color,background-color,border-color,outline-color,box-shadow,translate] duration-150 ease-out motion-reduce:transition-none",
];

/**
 * The `textFieldBase` look for a container whose `<input>` sits inside it (NumberField group,
 * Combobox input group). Written out rather than derived from `textFieldBase` by string surgery:
 * - Focus lives on the child input, so the ring uses `focus-within` instead of `focus`.
 * - A `<div>` never matches `:read-only` / `:disabled`, so it keys off Base UI's `data-readonly` /
 *   `data-disabled` / `data-invalid` (the group gets the Root / Field state), plus
 *   `has-aria-invalid:` for an `aria-invalid` set directly on the input without a `Field`.
 * - The transition list drops `outline-color` (Phase E spec, *Amended in Task 4*): transitioning
 *   it on a `:focus-within` ring (an ancestor of the focused element) leaves the ring interpolating
 *   from its pre-focus colour right after the focus change — a momentary wrong-colour flash —
 *   unlike a `:focus` ring on the focused element itself. Without it the ring colour snaps.
 */
export const textFieldGroupBase: string[] = [
  "inline-flex w-full min-w-0 items-stretch overflow-hidden rounded-md border border-field-border bg-field text-foreground shadow-xs",
  "not-data-disabled:not-data-invalid:not-has-aria-invalid:not-focus-within:hover:border-field-border-hover",
  "outline-none focus-within:outline-1 focus-within:outline-solid focus-within:outline-ring focus-within:border-ring forced-colors:focus-within:outline-[Highlight]",
  "data-invalid:border-danger data-invalid:focus-within:outline-danger has-aria-invalid:border-danger has-aria-invalid:focus-within:outline-danger",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50 data-readonly:bg-muted",
  "transition-[color,background-color,border-color,box-shadow,translate] duration-150 ease-out motion-reduce:transition-none",
];

/** Height, inline padding and text size per `size` (shared with the Select trigger). */
export const textFieldSizes = {
  sm: "h-8 px-2.5 text-sm",
  md: "h-10 px-3 text-sm",
  lg: "h-12 px-4 text-base",
} as const;

const inputCva = cva(textFieldBase, {
  variants: {
    size: textFieldSizes,
  },
  defaultVariants: inputDefaults,
});

export type InputVariantProps = VariantProps<typeof inputCva>;

/** Input classes for any element. */
export function inputVariants(options: InputVariantProps & { className?: string } = {}): string {
  const { className, ...variants } = options;
  return cn(inputCva(variants), className);
}
