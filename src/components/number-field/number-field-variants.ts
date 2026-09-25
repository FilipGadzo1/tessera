import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { textFieldGroupBase } from "../input/input-variants";

/** Defaults — shared by cva and the Group's data attributes. */
export const numberFieldDefaults = { size: "md" } as const;

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

const numberFieldGroupCva = cva(textFieldGroupBase, {
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
