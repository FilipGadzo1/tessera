"use client";

import { Input as BaseInput } from "@base-ui/react/input";
import type * as React from "react";
import { cn } from "../../lib/cn";
import {
  type ClassNameProp,
  mergeClassName,
  mergeStyle,
  type StyleProp,
} from "../../lib/merge-class-name";
import { textFieldBase } from "../input/input-variants";

/**
 * Textarea props: native `<textarea>` attributes (`rows`, `cols`, `maxLength`, `wrap`, …) with
 * textarea-typed event handlers and ref, plus Base UI Input's `value` / `defaultValue` /
 * `onValueChange` and a string-or-state-function `className` / `style`.
 * Built from `<textarea>` props rather than `BaseInput.Props`, so input-only attributes
 * (`type`, `accept`, `min`, `max`, `step`, `pattern`, `size`, …) are not offered.
 * `render` is omitted: the rendered element is always a `<textarea>`.
 */
export interface TextareaProps
  extends Omit<
    React.ComponentPropsWithRef<"textarea">,
    "className" | "style" | "value" | "defaultValue"
  > {
  /** The value of the textarea. Use when controlled. */
  value?: string | undefined;
  /** The initial value of the textarea. Use when uncontrolled. */
  defaultValue?: string | undefined;
  /** Called with the new string value whenever it changes. */
  onValueChange?: BaseInput.Props["onValueChange"];
  /** CSS classes, or a function of the Base UI field-control state returning them. */
  className?: ClassNameProp<BaseInput.State>;
  /** Inline style, or a function of the Base UI field-control state returning it. */
  style?: StyleProp<BaseInput.State>;
}

const textareaClasses = cn(
  textFieldBase,
  "min-h-20 px-3 py-2 text-sm field-sizing-content resize-y",
);

/**
 * `field-sizing: content` makes browsers ignore `rows` when sizing, so `rows` becomes a
 * `min-height` of that many lines plus the `py-2` padding and 1px borders.
 */
function rowsMinHeight(rows: number | undefined): React.CSSProperties | undefined {
  return rows ? { minHeight: `calc(${rows}lh + 1rem + 2px)` } : undefined;
}

/** A multi-line text field that grows with its content; `rows` sets the minimum height. Works standalone or inside a Field. */
export function Textarea({ className, style, rows, ...props }: TextareaProps) {
  return (
    <BaseInput
      // Base UI types Input's props for `<input>`; at runtime Field.Control forwards them to the
      // rendered `<textarea>`, so the textarea-typed props are passed through unchanged.
      {...(props as unknown as BaseInput.Props)}
      render={<textarea rows={rows} />}
      data-slot="textarea"
      className={mergeClassName(textareaClasses, className)}
      style={mergeStyle(rowsMinHeight(rows), style)}
    />
  );
}
