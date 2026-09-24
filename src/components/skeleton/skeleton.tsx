import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

export type SkeletonProps = ComponentProps<"div">;

/**
 * A pulsing placeholder shown while content loads. Shape it with `className`
 * (e.g. `size-12 rounded-full` for an avatar, `h-4 w-48` for a line of text). Server-safe.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      {...props}
      aria-hidden="true"
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-md bg-muted forced-colors:bg-[GrayText] motion-reduce:animate-none",
        className,
      )}
    />
  );
}
