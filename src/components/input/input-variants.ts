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
