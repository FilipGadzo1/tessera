"use client";

import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { cn } from "../../lib/cn";
import { mergeClassName } from "../../lib/merge-class-name";

/** Base UI Checkbox.Root props. Tessera renders the indicator, so `children` is ignored. */
export interface CheckboxProps extends Omit<BaseCheckbox.Root.Props, "children"> {
  /** A component built on Checkbox names its own part. @default "checkbox" */
  "data-slot"?: string;
}

const checkboxClasses = cn(
  "inline-flex shrink-0 items-center justify-center",
  "size-5 rounded-sm border border-field-border bg-field text-primary-foreground",
  "data-checked:bg-primary data-checked:not-data-invalid:border-primary data-indeterminate:bg-primary data-indeterminate:not-data-invalid:border-primary",
  "not-data-disabled:not-data-readonly:not-data-checked:not-data-indeterminate:not-data-invalid:hover:border-field-border-hover",
  "cursor-pointer not-data-disabled:data-readonly:cursor-default data-disabled:cursor-not-allowed data-disabled:opacity-50",
  "outline-none outline-offset-2 outline-ring focus-visible:outline-2 focus-visible:outline-solid",
  "data-invalid:border-danger",
  "transition-[color,background-color,border-color,outline-color,box-shadow,translate] duration-150 ease-out motion-reduce:transition-none",
);

function CheckIcon() {
  return (
    <svg
      data-icon="check"
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg
      data-icon="dash"
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

/** A checkbox with checked and indeterminate (dash) states. Pair with Label or use inside a Field. */
export function Checkbox({
  className,
  "data-slot": dataSlot = "checkbox",
  ...props
}: CheckboxProps) {
  return (
    <BaseCheckbox.Root
      {...props}
      data-slot={dataSlot}
      className={mergeClassName(checkboxClasses, className)}
    >
      <BaseCheckbox.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center"
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>{state.indeterminate ? <DashIcon /> : <CheckIcon />}</span>
        )}
      />
    </BaseCheckbox.Root>
  );
}
