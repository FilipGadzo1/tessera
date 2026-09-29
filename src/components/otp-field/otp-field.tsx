"use client";

import { OTPField as BaseOTPField } from "@base-ui/react/otp-field";
import { createContext, Fragment, useContext } from "react";
import { mergeClassName } from "../../lib/merge-class-name";
import {
  type OTPFieldVariantProps,
  otpFieldDefaults,
  otpFieldInputVariants,
} from "./otp-field-variants";

const OTPFieldSizeContext = createContext<OTPFieldVariantProps["size"]>(undefined);

/**
 * Base UI OTPField props plus Tessera's `size` (slot height, matching Input / Button) and
 * `groups`. `length` is required. Useful Base UI props: `onValueComplete(value)`,
 * `validationType` (`numeric` default | `alphanumeric` | …), `mask`, `autoSubmit`, `name`.
 */
export interface OTPFieldProps extends BaseOTPField.Root.Props, OTPFieldVariantProps {
  /**
   * Without children, split the `length` inputs into groups with a separator between them, for
   * example `[3, 3]`. The sizes should add up to `length`.
   */
  groups?: number[];
}

/**
 * A one-time-code field: one input per character, with typing, paste, Backspace and arrow keys
 * handled by Base UI. With no children it renders `length` inputs (grouped by `groups`); the first
 * takes the label from a surrounding `Field`, the others are named "Character N of L". Pass
 * children (`OTPFieldInput`, `OTPFieldSeparator`) for a custom layout.
 */
export function OTPField({ size, groups, className, children, length, ...props }: OTPFieldProps) {
  const resolvedSize = size ?? otpFieldDefaults.size;
  return (
    <OTPFieldSizeContext.Provider value={resolvedSize}>
      <BaseOTPField.Root
        {...props}
        length={length}
        data-slot="otp-field"
        data-size={resolvedSize}
        className={mergeClassName("flex items-center gap-2", className)}
      >
        {children ?? <DefaultSlots length={length} groups={groups} />}
      </BaseOTPField.Root>
    </OTPFieldSizeContext.Provider>
  );
}

function DefaultSlots({ length, groups }: { length: number; groups?: number[] }) {
  const sizes = groups?.length ? groups : [length];
  let index = 0;
  return sizes.map((count, groupIndex) => {
    const start = index;
    index += count;
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: the groups are positional and never reorder
      <Fragment key={groupIndex}>
        {groupIndex > 0 && <OTPFieldSeparator />}
        {Array.from({ length: count }, (_, offset) => {
          const slot = start + offset;
          return (
            <OTPFieldInput
              key={slot}
              aria-label={slot === 0 ? undefined : `Character ${slot + 1} of ${length}`}
            />
          );
        })}
      </Fragment>
    );
  });
}

export type OTPFieldInputProps = BaseOTPField.Input.Props;

/** One character slot; render one per `length` inside `OTPField`. Every slot after the first needs an `aria-label`. */
export function OTPFieldInput({ className, ...props }: OTPFieldInputProps) {
  const size = useContext(OTPFieldSizeContext);
  return (
    <BaseOTPField.Input
      {...props}
      data-slot="otp-field-input"
      className={mergeClassName(otpFieldInputVariants({ size }), className)}
    />
  );
}

export type OTPFieldSeparatorProps = BaseOTPField.Separator.Props;

/** A decorative dash between groups of slots (hidden from assistive technology). */
export function OTPFieldSeparator({ className, ...props }: OTPFieldSeparatorProps) {
  return (
    <BaseOTPField.Separator
      aria-hidden="true"
      {...props}
      data-slot="otp-field-separator"
      className={mergeClassName("h-0 w-3 shrink-0 border-t-2 border-muted-foreground", className)}
    />
  );
}
