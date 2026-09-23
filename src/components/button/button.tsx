"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { type ButtonVariantProps, buttonVariants } from "./button-variants";

export interface ButtonProps extends BaseButton.Props, ButtonVariantProps {
  /** Shows a spinner, sets aria-busy, and blocks interaction while keeping focus. */
  loading?: boolean;
}

export function Button({
  variant,
  size,
  loading = false,
  disabled,
  focusableWhenDisabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      {...props}
      data-slot="button"
      data-variant={variant ?? "primary"}
      data-size={size ?? "md"}
      data-loading={loading ? "" : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      focusableWhenDisabled={loading || focusableWhenDisabled}
      className={(state) =>
        buttonVariants({
          variant,
          size,
          className: typeof className === "function" ? className(state) : className,
        })
      }
    >
      {loading && <ButtonSpinner />}
      {children}
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
