"use client";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { OTPField as BaseOTPField } from "@base-ui/react/otp-field";
import { createContext, Fragment, useContext, useEffect, useRef } from "react";
import { mergeClassName } from "../../lib/merge-class-name";
import { useElementDirection } from "../../lib/use-element-direction";
import { useMergedRefs } from "../../lib/use-merged-refs";
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
   * example `[3, 3]`. The sizes should add up to `length`; otherwise the inputs still follow
   * `length` (extra groups are dropped, leftover slots go in the last group) and dev builds warn.
   */
  groups?: number[];
}

/**
 * A one-time-code field: one input per character, with typing, paste, Backspace and arrow keys
 * handled by Base UI. With no children it renders `length` inputs (grouped by `groups`); the first
 * takes the label from a surrounding `Field`, the others are named "Character N of L". Pass
 * children (`OTPFieldInput`, `OTPFieldSeparator`) for a custom layout.
 */
export function OTPField({
  size,
  groups,
  className,
  children,
  length,
  ref,
  ...props
}: OTPFieldProps) {
  const resolvedSize = size ?? otpFieldDefaults.size;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRootRef = useMergedRefs(rootRef, ref);
  const direction = useElementDirection(rootRef);
  return (
    <OTPFieldSizeContext.Provider value={resolvedSize}>
      <DirectionProvider direction={direction}>
        <BaseOTPField.Root
          {...props}
          ref={setRootRef}
          length={length}
          data-slot="otp-field"
          data-size={resolvedSize}
          className={mergeClassName("flex items-center gap-2", className)}
        >
          {children ?? <DefaultSlots length={length} groups={groups} />}
        </BaseOTPField.Root>
      </DirectionProvider>
    </OTPFieldSizeContext.Provider>
  );
}

/** Group sizes that add up to `length`: extra groups are dropped, leftover slots join the last. */
function fitGroups(length: number, groups: number[] | undefined): number[] {
  if (!groups?.length) return [length];
  const fitted: number[] = [];
  let remaining = length;
  for (const count of groups) {
    if (remaining <= 0) break;
    const take = Math.min(Math.max(count, 0), remaining);
    if (take > 0) fitted.push(take);
    remaining -= take;
  }
  if (remaining > 0) fitted[fitted.length - 1] = (fitted[fitted.length - 1] ?? 0) + remaining;
  return fitted;
}

function DefaultSlots({ length, groups }: { length: number; groups?: number[] }) {
  const mismatch =
    groups != null && groups.length > 0 && groups.reduce((a, b) => a + b, 0) !== length;
  const warned = useRef(false);
  useEffect(() => {
    // Once per instance, not on every render.
    if (process.env.NODE_ENV !== "production" && mismatch && !warned.current) {
      warned.current = true;
      console.warn(
        "OTPField: the `groups` sizes don't add up to `length`. The inputs follow `length`: " +
          "extra groups are dropped and leftover slots go in the last group.",
      );
    }
  }, [mismatch]);
  let index = 0;
  return fitGroups(length, groups).map((count, groupIndex) => {
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
