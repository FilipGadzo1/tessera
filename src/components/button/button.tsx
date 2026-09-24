"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { mergeClassName } from "../../lib/merge-class-name";
import { type ButtonVariantProps, buttonDefaults, buttonVariants } from "./button-variants";

export interface ButtonProps extends Omit<BaseButton.Props, "color">, ButtonVariantProps {
  /** Shows a spinner, sets aria-busy, and blocks interaction while keeping focus. */
  loading?: boolean;
}

export function Button({
  variant,
  color,
  size,
  loading = false,
  disabled,
  focusableWhenDisabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const resolvedSize = size ?? buttonDefaults.size;
  // Icon-only sizes are a fixed box: while loading, the spinner replaces the icon
  // (the accessible name comes from aria-label, not the children).
  const spinnerOnly = loading && resolvedSize.startsWith("icon");
  return (
    <BaseButton
      {...props}
      data-slot="button"
      data-variant={variant ?? buttonDefaults.variant}
      data-color={color ?? buttonDefaults.color}
      data-size={resolvedSize}
      data-loading={loading ? "" : undefined}
      aria-busy={loading || props["aria-busy"]}
      disabled={disabled || loading}
      focusableWhenDisabled={loading || focusableWhenDisabled}
      className={mergeClassName(buttonVariants({ variant, color, size }), className)}
    >
      {loading && <ButtonSpinner />}
      {!spinnerOnly && children}
    </BaseButton>
  );
}

function ButtonSpinner() {
  return (
    <svg
      aria-hidden="true"
      data-slot="button-spinner"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
