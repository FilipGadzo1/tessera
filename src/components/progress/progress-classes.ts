/**
 * Class strings shared by Progress and Meter (server-safe, no directive, no hooks). Meter mirrors
 * Progress exactly except for the indeterminate state, which only Progress has.
 */

export type ProgressMeterSize = "sm" | "md" | "lg";

export const progressMeterTrackSizes: Record<ProgressMeterSize, string> = {
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
};

/** Root wrapper: column of an optional header row above the track. */
export const progressMeterRootClass = "flex w-full flex-col gap-2";

/** Header row holding the label/value children above the track. */
export const progressMeterHeaderClass = "flex items-center justify-between gap-2";

/** Track: the full range behind the indicator. */
export const progressMeterTrackClass =
  "relative w-full overflow-hidden rounded-full bg-muted forced-colors:outline forced-colors:outline-1 forced-colors:outline-[CanvasText]";

/** Indicator: the filled portion. Meter uses this as-is; Progress adds indeterminate classes. */
export const progressMeterIndicatorClass =
  "h-full rounded-full bg-tone transition-[width] duration-300 ease-out motion-reduce:transition-none forced-colors:bg-[Highlight]";

/** Label text (ProgressLabel / MeterLabel). */
export const progressMeterLabelClass = "text-sm font-medium text-foreground";

/** Formatted value text (ProgressValue / MeterValue). */
export const progressMeterValueClass = "ms-auto text-sm tabular-nums text-muted-foreground";
