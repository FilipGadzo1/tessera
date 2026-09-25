"use client";

import { Progress as BaseProgress } from "@base-ui/react/progress";
import { cn } from "../../lib/cn";
import { mergeClassName } from "../../lib/merge-class-name";
import { type ToneColor, toneClass } from "../../lib/tone";
import {
  type ProgressMeterSize,
  progressMeterHeaderClass,
  progressMeterIndicatorClass,
  progressMeterLabelClass,
  progressMeterRootClass,
  progressMeterTrackClass,
  progressMeterTrackSizes,
  progressMeterValueClass,
} from "./progress-classes";

export type ProgressSize = ProgressMeterSize;

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
      className={mergeClassName(cn(progressMeterRootClass, toneClass[color]), className)}
    >
      {children != null && (
        <div data-slot="progress-header" className={progressMeterHeaderClass}>
          {children}
        </div>
      )}
      <BaseProgress.Track
        data-slot="progress-track"
        className={cn(progressMeterTrackClass, progressMeterTrackSizes[size])}
      >
        <BaseProgress.Indicator
          data-slot="progress-indicator"
          className={cn(
            progressMeterIndicatorClass,
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
      className={mergeClassName(progressMeterLabelClass, className)}
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
      className={mergeClassName(progressMeterValueClass, className)}
    />
  );
}
