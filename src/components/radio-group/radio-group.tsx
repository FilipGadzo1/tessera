"use client";

import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { cn } from "../../lib/cn";

/** Base UI RadioGroup props. Name it with `aria-label(ledby)` or render it through a Fieldset. */
export type RadioGroupProps<Value = unknown> = BaseRadioGroup.Props<Value>;
/** Base UI Radio.Root props. Tessera renders the indicator dot, so `children` is ignored. */
export type RadioProps<Value = unknown> = BaseRadio.Root.Props<Value>;

const radioClasses = cn(
  "inline-flex shrink-0 items-center justify-center",
  "size-5 rounded-full border border-field-border bg-field",
  "data-checked:bg-primary data-checked:not-data-invalid:border-primary",
  "not-data-disabled:not-data-checked:not-data-indeterminate:not-data-invalid:hover:border-field-border-hover",
  "cursor-pointer data-disabled:cursor-not-allowed data-disabled:opacity-50",
  "outline-hidden outline-offset-2 outline-ring focus-visible:outline-2 focus-visible:outline-solid",
  "data-invalid:border-danger",
  "transition-[color,background-color,border-color,outline-color,box-shadow,translate] duration-150 ease-out motion-reduce:transition-none",
);

/** A set of radios sharing one value. Vertical by default; pass `flex-row` for a row. */
export function RadioGroup<Value>({ className, ...props }: RadioGroupProps<Value>) {
  return (
    <BaseRadioGroup
      {...props}
      data-slot="radio-group"
      className={(state) =>
        cn("flex flex-col gap-2", typeof className === "function" ? className(state) : className)
      }
    />
  );
}

/** One option in a RadioGroup. Pair with Label or use inside a Field. */
export function Radio<Value>({ className, ...props }: RadioProps<Value>) {
  return (
    <BaseRadio.Root
      {...props}
      data-slot="radio"
      className={(state) =>
        cn(radioClasses, typeof className === "function" ? className(state) : className)
      }
    >
      <BaseRadio.Indicator
        data-slot="radio-indicator"
        className="size-2 rounded-full bg-primary-foreground"
      />
    </BaseRadio.Root>
  );
}
