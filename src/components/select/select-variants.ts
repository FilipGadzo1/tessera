import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { textFieldBase, textFieldSizes } from "../input/input-variants";

/** Defaults — shared by cva and the trigger's data attributes. */
export const selectDefaults = { size: "md" } as const;

/*
 * The trigger is a `<button>`, and every button matches `:read-only` (only editable elements match
 * `:read-write`), so the text-field `read-only:bg-muted` would paint every trigger muted. It keys
 * off Base UI's `data-readonly` instead.
 */
const selectTriggerBase = [
  ...textFieldBase.map((classes) =>
    classes.replace("read-only:bg-muted", "data-readonly:bg-muted"),
  ),
  "inline-flex items-center justify-between gap-2 cursor-pointer text-left",
];

const selectTriggerCva = cva(selectTriggerBase, {
  variants: { size: textFieldSizes },
  defaultVariants: selectDefaults,
});

export type SelectTriggerVariantProps = VariantProps<typeof selectTriggerCva>;

/** Select trigger classes (the Input look plus the chevron layout) for any element. */
export function selectTriggerVariants(
  options: SelectTriggerVariantProps & { className?: string } = {},
): string {
  const { className, ...variants } = options;
  return cn(selectTriggerCva(variants), className);
}
