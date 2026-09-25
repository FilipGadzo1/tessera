"use client";

import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { useEffect, useRef } from "react";
import { MinusIcon, PlusIcon } from "../../lib/icons";
import { mergeClassName } from "../../lib/merge-class-name";
import {
  type NumberFieldGroupVariantProps,
  numberFieldDefaults,
  numberFieldGroupVariants,
} from "./number-field-variants";

export type NumberFieldProps = BaseNumberField.Root.Props;

/**
 * Groups all parts and owns the numeric value. With no children it renders the common stepper
 * (`NumberFieldGroup` → `NumberFieldDecrement`, `NumberFieldInput`, `NumberFieldIncrement`) at the
 * default size, naming the input from a plain `aria-label`/`aria-labelledby` (Base UI's Root
 * renders an unlabelable `<div>`, so those props would otherwise land somewhere assistive tech
 * never reads). Pass children to compose the parts yourself (e.g. a non-default `size`, or a
 * `NumberFieldScrubArea`) — in that case set `aria-label`/`aria-labelledby` on your own
 * `NumberFieldInput` directly: this component can no longer thread them to it, and — since a label
 * on a generic, non-labelable `<div>` isn't valid ARIA — it never forwards them to the Root either;
 * passing both `children` and a plain `aria-label`/`aria-labelledby` here logs a dev warning. Works
 * inside a `Field`: the `FieldLabel` names the input, and an invalid `Field` gives the group a
 * danger border.
 */
export function NumberField({
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: NumberFieldProps) {
  const ignoredLabel = children != null && (ariaLabel != null || ariaLabelledBy != null);
  const warned = useRef(false);
  useEffect(() => {
    // Once per instance, not on every render.
    if (process.env.NODE_ENV !== "production" && ignoredLabel && !warned.current) {
      warned.current = true;
      console.warn(
        "NumberField: `aria-label`/`aria-labelledby` is ignored when `children` is given — it " +
          "can't be forwarded to a custom subtree, and Base UI's Root renders a plain, " +
          "non-labelable `<div>`, so it isn't applied there either. Set " +
          "`aria-label`/`aria-labelledby` directly on your own `NumberFieldInput` instead.",
      );
    }
  }, [ignoredLabel]);
  return (
    <BaseNumberField.Root {...props} data-slot="number-field">
      {children ?? (
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      )}
    </BaseNumberField.Root>
  );
}

export interface NumberFieldGroupProps
  extends BaseNumberField.Group.Props,
    NumberFieldGroupVariantProps {}

/**
 * Groups the input with the increment/decrement buttons on the text-field look (focus-within ring
 * instead of focus, since the real focus target is the child `NumberFieldInput`).
 */
export function NumberFieldGroup({ size, className, ...props }: NumberFieldGroupProps) {
  return (
    <BaseNumberField.Group
      {...props}
      data-slot="number-field-group"
      data-size={size ?? numberFieldDefaults.size}
      className={mergeClassName(numberFieldGroupVariants({ size }), className)}
    />
  );
}

export type NumberFieldInputProps = BaseNumberField.Input.Props;

/** The borderless, centered text input. Its formatted value is set by `format` on `NumberField`. */
export function NumberFieldInput({ className, ...props }: NumberFieldInputProps) {
  return (
    <BaseNumberField.Input
      {...props}
      data-slot="number-field-input"
      className={mergeClassName(
        "min-w-0 flex-1 bg-transparent px-3 text-center tabular-nums outline-none",
        className,
      )}
    />
  );
}

const numberFieldButtonBase =
  "flex aspect-square h-full cursor-pointer items-center justify-center text-muted-foreground not-data-disabled:hover:bg-muted not-data-disabled:hover:text-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50";

export type NumberFieldIncrementProps = BaseNumberField.Increment.Props;

/** Increases the value by `step` (or `smallStep`/`largeStep` with Alt/Shift) while pressed or held. */
export function NumberFieldIncrement({ className, ...props }: NumberFieldIncrementProps) {
  return (
    <BaseNumberField.Increment
      {...props}
      data-slot="number-field-increment"
      className={mergeClassName(`${numberFieldButtonBase} border-l border-field-border`, className)}
    >
      <PlusIcon className="size-3.5" />
    </BaseNumberField.Increment>
  );
}

export type NumberFieldDecrementProps = BaseNumberField.Decrement.Props;

/** Decreases the value by `step` (or `smallStep`/`largeStep` with Alt/Shift) while pressed or held. */
export function NumberFieldDecrement({ className, ...props }: NumberFieldDecrementProps) {
  return (
    <BaseNumberField.Decrement
      {...props}
      data-slot="number-field-decrement"
      className={mergeClassName(`${numberFieldButtonBase} border-r border-field-border`, className)}
    >
      <MinusIcon className="size-3.5" />
    </BaseNumberField.Decrement>
  );
}

export type NumberFieldScrubAreaProps = BaseNumberField.ScrubArea.Props;

/**
 * An area (typically wrapping a label) the user can click-drag to change the value, like a
 * spreadsheet's fill handle. Optional; most number fields only need the stepper buttons.
 */
export function NumberFieldScrubArea({ className, ...props }: NumberFieldScrubAreaProps) {
  return (
    <BaseNumberField.ScrubArea
      {...props}
      data-slot="number-field-scrub-area"
      className={mergeClassName("cursor-ew-resize select-none text-sm font-medium", className)}
    />
  );
}
