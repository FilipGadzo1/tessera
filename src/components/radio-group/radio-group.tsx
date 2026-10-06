"use client";

import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { cn } from "../../lib/cn";
import { mergeClassName } from "../../lib/merge-class-name";

/** Base UI RadioGroup props. Name it with `aria-label(ledby)` or render it through a Fieldset. */
export type RadioGroupProps<Value = unknown> = BaseRadioGroup.Props<Value>;
/** Base UI Radio.Root props. Tessera renders the indicator dot, so `children` is ignored. */
export type RadioProps<Value = unknown> = Omit<BaseRadio.Root.Props<Value>, "children">;

const radioClasses = cn(
  "inline-flex shrink-0 items-center justify-center",
  "size-5 rounded-full border border-field-border bg-field",
  "data-checked:bg-primary data-checked:not-data-invalid:border-primary",
  "not-data-disabled:not-data-readonly:not-data-checked:not-data-indeterminate:not-data-invalid:hover:border-field-border-hover",
  "cursor-pointer data-readonly:cursor-default data-disabled:cursor-not-allowed data-disabled:opacity-50",
  "outline-none outline-offset-2 outline-ring focus-visible:outline-2 focus-visible:outline-solid",
  "data-invalid:border-danger",
  "transition-[color,background-color,border-color,outline-color,box-shadow,translate] duration-150 ease-out motion-reduce:transition-none",
);

/**
 * A set of radios sharing one value, stacked vertically. Standalone, pass `className="flex-row"`
 * for a row. Composed via `<Fieldset render={<RadioGroup />}>`, the Fieldset's own classes win
 * over the RadioGroup's className and the legend sits in the same flex container, so wrap the
 * options instead: `<div className="flex flex-row gap-6">…</div>` after the FieldsetLegend.
 */
export function RadioGroup<Value>({ className, ...props }: RadioGroupProps<Value>) {
  return (
    <BaseRadioGroup
      {...props}
      data-slot="radio-group"
      className={mergeClassName("flex flex-col gap-2", className)}
    />
  );
}

/** One option in a RadioGroup. Pair with Label or use inside a Field. */
export function Radio<Value>({ className, ...props }: RadioProps<Value>) {
  return (
    <BaseRadio.Root
      {...props}
      data-slot="radio"
      className={mergeClassName(radioClasses, className)}
    >
      <BaseRadio.Indicator
        data-slot="radio-indicator"
        className="size-2 rounded-full bg-primary-foreground"
      />
    </BaseRadio.Root>
  );
}
