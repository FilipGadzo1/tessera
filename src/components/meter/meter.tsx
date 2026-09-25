"use client";

import { Meter as BaseMeter } from "@base-ui/react/meter";
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
} from "../progress/progress-classes";

export type MeterSize = ProgressMeterSize;

export interface MeterProps extends BaseMeter.Root.Props {
  /** Tone of the filled bar. @default "primary" */
  color?: ToneColor;
  /** Bar thickness. @default "md" */
  size?: MeterSize;
}

/**
 * A meter for a measurement within a known range (disk usage, password strength) — not task
 * completion (use Progress for that). Mirrors Progress: the same props shape, header row for
 * MeterLabel / MeterValue children, track and indicator. Unlike Progress it has no indeterminate
 * state (`value` is required). `role="meter"` and `aria-valuenow`/`aria-valuemin`/`aria-valuemax`/
 * `aria-valuetext` (from `format`) come from Base UI. A MeterLabel names it; otherwise pass
 * `aria-label`.
 */
export function Meter({
  color = "primary",
  size = "md",
  value,
  className,
  children,
  ...props
}: MeterProps) {
  return (
    <BaseMeter.Root
      {...props}
      value={value}
      data-slot="meter"
      data-color={color}
      data-size={size}
      className={mergeClassName(cn(progressMeterRootClass, toneClass[color]), className)}
    >
      {children != null && (
        <div data-slot="meter-header" className={progressMeterHeaderClass}>
          {children}
        </div>
      )}
      <BaseMeter.Track
        data-slot="meter-track"
        className={cn(progressMeterTrackClass, progressMeterTrackSizes[size])}
      >
        <BaseMeter.Indicator data-slot="meter-indicator" className={progressMeterIndicatorClass} />
      </BaseMeter.Track>
    </BaseMeter.Root>
  );
}

export type MeterLabelProps = BaseMeter.Label.Props;

/** Visible name of the meter (wired to it via `aria-labelledby`). */
export function MeterLabel({ className, ...props }: MeterLabelProps) {
  return (
    <BaseMeter.Label
      {...props}
      data-slot="meter-label"
      className={mergeClassName(progressMeterLabelClass, className)}
    />
  );
}

export type MeterValueProps = BaseMeter.Value.Props;

/** The formatted current value (a percentage unless `format` is set on Meter). */
export function MeterValue({ className, ...props }: MeterValueProps) {
  return (
    <BaseMeter.Value
      {...props}
      data-slot="meter-value"
      className={mergeClassName(progressMeterValueClass, className)}
    />
  );
}
