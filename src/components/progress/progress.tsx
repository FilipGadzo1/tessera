"use client";

import { Progress as BaseProgress } from "@base-ui/react/progress";
import { cn } from "../../lib/cn";
import { mergeClassName } from "../../lib/merge-class-name";
import { type ToneColor, toneClass } from "../../lib/tone";

export type ProgressSize = "sm" | "md" | "lg";

const trackSizes: Record<ProgressSize, string> = {
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
};

export interface ProgressProps extends Omit<BaseProgress.Root.Props, "color"> {
  /** Tone of the filled bar. @default "primary" */
  color?: ToneColor;
  /** Bar thickness. @default "md" */
  size?: ProgressSize;
}

/**
 * A progress bar. `value={null}` is indeterminate. Children (ProgressLabel, ProgressValue) render
 * in a row above the bar; a ProgressLabel names the bar, otherwise pass `aria-label`.
 */
export function Progress({
  color = "primary",
  size = "md",
  value,
  className,
  children,
  ...props
}: ProgressProps) {
  const indeterminate = value == null || !Number.isFinite(value);
  return (
    <BaseProgress.Root
      {...props}
      value={value}
      data-slot="progress"
      data-color={color}
      data-size={size}
      className={mergeClassName(cn("flex w-full flex-col gap-2", toneClass[color]), className)}
    >
      {children != null && (
        <div data-slot="progress-header" className="flex items-center justify-between gap-2">
          {children}
        </div>
      )}
      <BaseProgress.Track
        data-slot="progress-track"
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-muted forced-colors:outline forced-colors:outline-1 forced-colors:outline-[CanvasText]",
          trackSizes[size],
        )}
      >
        <BaseProgress.Indicator
          data-slot="progress-indicator"
          className={cn(
            "h-full rounded-full bg-tone transition-[width] duration-300 ease-out motion-reduce:transition-none forced-colors:bg-[Highlight]",
            indeterminate &&
              "w-1/3 animate-[tsr-indeterminate_1.2s_ease-in-out_infinite] motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-50",
          )}
        />
      </BaseProgress.Track>
    </BaseProgress.Root>
  );
}

export type ProgressLabelProps = BaseProgress.Label.Props;

/** Visible name of the progress bar (wired to it via `aria-labelledby`). */
export function ProgressLabel({ className, ...props }: ProgressLabelProps) {
  return (
    <BaseProgress.Label
      {...props}
      data-slot="progress-label"
      className={mergeClassName("text-sm font-medium text-foreground", className)}
    />
  );
}

export type ProgressValueProps = BaseProgress.Value.Props;

/** The formatted current value (a percentage unless `format` is set on Progress). */
export function ProgressValue({ className, ...props }: ProgressValueProps) {
  return (
    <BaseProgress.Value
      {...props}
      data-slot="progress-value"
      className={mergeClassName("ms-auto text-sm tabular-nums text-muted-foreground", className)}
    />
  );
}
