import type { ComponentProps } from "react";
import { type BadgeVariantProps, badgeDefaults, badgeVariants } from "./badge-variants";

export interface BadgeProps extends Omit<ComponentProps<"span">, "color">, BadgeVariantProps {}

/** A short status or category label. */
export function Badge({ variant, color, size, className, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      data-slot="badge"
      data-variant={variant ?? badgeDefaults.variant}
      data-color={color ?? badgeDefaults.color}
      data-size={size ?? badgeDefaults.size}
      className={badgeVariants({ variant, color, size, className })}
    />
  );
}
