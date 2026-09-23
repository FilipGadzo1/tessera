import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

export type LabelProps = ComponentProps<"label">;

/** A form label. Server-safe; use `htmlFor` or wrap the control. Inside a Field, use FieldLabel. */
export function Label({ className, ...props }: LabelProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: a generic primitive; callers pass htmlFor or nest the control.
    <label
      {...props}
      data-slot="label"
      className={cn("text-sm font-medium leading-snug text-foreground", className)}
    />
  );
}
