"use client";

import { Input as BaseInput } from "@base-ui/react/input";
import { mergeClassName } from "../../lib/merge-class-name";
import { type InputVariantProps, inputDefaults, inputVariants } from "./input-variants";

/** `size` is Tessera's height scale; the native `<input size>` attribute is omitted. */
export interface InputProps extends Omit<BaseInput.Props, "size">, InputVariantProps {}

/** A single-line text field. Works standalone (pair with Label) or inside a Field. */
export function Input({ size, className, ...props }: InputProps) {
  return (
    <BaseInput
      {...props}
      data-slot="input"
      data-size={size ?? inputDefaults.size}
      className={mergeClassName(inputVariants({ size }), className)}
    />
  );
}
