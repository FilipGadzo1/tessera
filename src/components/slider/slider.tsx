"use client";

import { Slider as BaseSlider } from "@base-ui/react/slider";
import { cn } from "../../lib/cn";
import { mergeClassName } from "../../lib/merge-class-name";
import { type ToneColor, toneClass } from "../../lib/tone";

export type SliderSize = "sm" | "md";

const trackSizes: Record<SliderSize, string> = {
  sm: "h-1 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1",
  md: "h-1.5 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5",
};

const thumbSizes: Record<SliderSize, string> = {
  sm: "size-4",
  md: "size-5",
};

export interface SliderProps<Value extends number | readonly number[] = number>
  extends Omit<BaseSlider.Root.Props<Value>, "color"> {
  /** Tone of the track's indicator and the thumb border. @default "primary" */
  color?: ToneColor;
  /** Track thickness and thumb diameter. @default "md" */
  size?: SliderSize;
  /**
   * Accessible name per thumb, index-aligned with the value/defaultValue array — for range
   * sliders whose thumbs need distinct names. A single-thumb slider is named by a `SliderLabel`,
   * a wrapping `Field`, or its own `aria-label`.
   */
  thumbLabels?: string[];
}

function thumbCountOf(value: unknown): number {
  return Array.isArray(value) ? value.length : 1;
}

/**
 * A draggable value picker. Renders Root → Control → Track → Indicator + one Thumb per value
 * (the value/defaultValue array length, or one for a plain number). Children (SliderLabel,
 * SliderValue) render in a row above the control, as with Progress.
 */
export function Slider<Value extends number | readonly number[] = number>({
  color = "primary",
  size = "md",
  className,
  children,
  thumbLabels,
  value,
  defaultValue,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: SliderProps<Value>) {
  const thumbCount = thumbCountOf(value ?? defaultValue);
  const getAriaLabel = thumbLabels ? (index: number) => thumbLabels[index] ?? "" : undefined;
  // A plain `aria-label`/`aria-labelledby` names the single thumb directly (Base UI's Root only
  // uses its own `aria-label` prop for the wrapping `role="group"`, not the thumb's `<input>`);
  // for a range slider without `thumbLabels`, thumbs fall back to a `SliderLabel`/Field label.
  const soloThumbAriaLabel = !getAriaLabel && thumbCount === 1 ? ariaLabel : undefined;
  const soloThumbAriaLabelledBy = !getAriaLabel && thumbCount === 1 ? ariaLabelledBy : undefined;

  return (
    <BaseSlider.Root
      {...props}
      value={value}
      defaultValue={defaultValue}
      aria-labelledby={ariaLabelledBy}
      data-slot="slider"
      data-color={color}
      data-size={size}
      className={mergeClassName(
        cn(
          "relative flex w-full touch-none select-none flex-col gap-2 data-disabled:opacity-50",
          toneClass[color],
        ),
        className,
      )}
    >
      {children != null && (
        <div data-slot="slider-header" className="flex items-center justify-between gap-2">
          {children}
        </div>
      )}
      <BaseSlider.Control
        data-slot="slider-control"
        className="flex h-5 items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:w-5 data-[orientation=vertical]:flex-col"
      >
        <BaseSlider.Track
          data-slot="slider-track"
          className={cn(
            "relative w-full grow overflow-hidden rounded-full bg-muted forced-colors:outline forced-colors:outline-1 forced-colors:outline-[CanvasText]",
            trackSizes[size],
          )}
        >
          <BaseSlider.Indicator
            data-slot="slider-indicator"
            className="bg-tone forced-colors:bg-[Highlight]"
          />
          {Array.from({ length: thumbCount }, (_, index) => (
            <BaseSlider.Thumb
              // biome-ignore lint/suspicious/noArrayIndexKey: thumbs are identified by their fixed index into the value array (also the `index` prop); that count doesn't reorder at runtime.
              key={index}
              index={index}
              data-slot="slider-thumb"
              getAriaLabel={getAriaLabel}
              aria-label={soloThumbAriaLabel}
              aria-labelledby={soloThumbAriaLabelledBy}
              className={cn(
                "block cursor-grab rounded-full border-2 border-tone bg-background shadow-sm active:cursor-grabbing data-disabled:cursor-not-allowed",
                "outline-none outline-offset-2 outline-ring has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-solid",
                "forced-colors:border-[CanvasText] forced-colors:has-[:focus-visible]:outline-[Highlight]",
                thumbSizes[size],
              )}
            />
          ))}
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}

export type SliderLabelProps = BaseSlider.Label.Props;

/** Visible name of the slider's thumb(s), wired via `aria-labelledby` (Base UI Slider.Label). */
export function SliderLabel({ className, ...props }: SliderLabelProps) {
  return (
    <BaseSlider.Label
      {...props}
      data-slot="slider-label"
      className={mergeClassName("text-sm font-medium text-foreground", className)}
    />
  );
}

export type SliderValueProps = BaseSlider.Value.Props;

/** The formatted current value(s) of the slider. */
export function SliderValue({ className, ...props }: SliderValueProps) {
  return (
    <BaseSlider.Value
      {...props}
      data-slot="slider-value"
      className={mergeClassName("ms-auto text-sm tabular-nums text-muted-foreground", className)}
    />
  );
}
