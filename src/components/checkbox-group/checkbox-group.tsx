"use client";

import { CheckboxGroup as BaseCheckboxGroup } from "@base-ui/react/checkbox-group";
import { mergeClassName } from "../../lib/merge-class-name";

/**
 * Base UI CheckboxGroup props: `value` / `defaultValue` + `onValueChange` (arrays of checkbox
 * values), `allValues` (enables a `parent` Checkbox), `disabled`.
 */
export type CheckboxGroupProps = BaseCheckboxGroup.Props;

/**
 * Shares one array of checked values between Checkboxes. Stacks them; pass `className="flex-row"`
 * for a row. Name it with `Fieldset` + `FieldsetLegend` (`<Fieldset render={<CheckboxGroup />}>`),
 * or `aria-labelledby`.
 */
export function CheckboxGroup({ className, ...props }: CheckboxGroupProps) {
  return (
    <BaseCheckboxGroup
      {...props}
      data-slot="checkbox-group"
      className={mergeClassName("flex flex-col gap-3", className)}
    />
  );
}
