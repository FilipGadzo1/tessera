import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

export type AvatarGroupProps = ComponentProps<"div">;

/** A row of overlapping avatars, each ringed in the background color. Server-safe. */
export function AvatarGroup({ className, ...props }: AvatarGroupProps) {
  return (
    <div
      {...props}
      data-slot="avatar-group"
      className={cn("flex -space-x-2 [&>*]:ring-2 [&>*]:ring-background", className)}
    />
  );
}
