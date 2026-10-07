"use client";

/*
 * TimeField (spec Phase K §2): DateField's plumbing (`../field/segments.tsx`) with its own segment
 * engine (`./time-segments-control.tsx`). The Field wiring is DateField's: the group registers a
 * `null` labelable id and takes its name from `aria-labelledby`; Form and Field validation go
 * through the shared hidden-input control (`../field/form-control.tsx`, `slot:
 * "time-form-control"`).
 */
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useLabelableContext, useLabelableId } from "@base-ui/react/internals/labelable-provider";
import { type ComponentProps, type RefObject, useEffect, useId, useMemo, useRef } from "react";
import { cn } from "../../lib/cn";
import { resolveLocale } from "../../lib/date";
import {
  compareTime,
  formatTime,
  formatTimeValue,
  parseTime,
  resolveHourCycle,
  type TimeGranularity,
  timeStepMismatch,
} from "../../lib/time";
import { parseTimeString } from "../../lib/time-segments";
import { useControllableState } from "../../lib/use-controllable-state";
import { useMergedRefs } from "../../lib/use-merged-refs";
import { useFocusScope, useFormControl } from "../field/form-control";
import {
  handleGroupMouseDown,
  segmentGroupBase,
  useLabelFocusesFirstEmpty,
  useSubmitOnEnter,
} from "../field/segments";
import { textFieldSizes } from "../input/input-variants";
import {
  type TimeSegmentLabels,
  timeSegmentSelector,
  useTimeSegments,
} from "./time-segments-control";

/**
 * Translatable strings for the segments' accessible names, the empty value text and the
 * validation messages. `minText` / `maxText` are the bounds formatted with `formatTime` in the
 * field's locale and hour cycle.
 */
export interface TimeFieldLabels extends TimeSegmentLabels {
  /** The validation message while only some segments are filled. @default "Enter a complete time." */
  incomplete?: string;
  /** @default (minText) => `Enter a time at or after ${minText}.` */
  rangeUnderflow?: (minText: string) => string;
  /** @default (maxText) => `Enter a time at or before ${maxText}.` */
  rangeOverflow?: (maxText: string) => string;
  /**
   * The message for a time off the `step` grid (counted from `min`), given `step` in seconds.
   * @default whole minutes: `Enter a time in ${step / 60}-minute steps.`, else
   * `Enter a time in ${step}-second steps.`
   */
  stepMismatch?: (step: number) => string;
}

export interface TimeFieldProps
  extends Omit<ComponentProps<"div">, "defaultValue" | "onChange" | "children"> {
  /** The time, controlled: `"HH:mm"` (`"HH:mm:ss"` at second granularity), `null` for none. */
  value?: string | null;
  /** The initial time. @default null */
  defaultValue?: string | null;
  /**
   * Called with the time once every needed segment is set, and with `null` when the user clears
   * a segment of a complete time. Partial input never calls it.
   */
  onValueChange?: (value: string | null) => void;
  /** Whether the field has a second segment (and reports `"HH:mm:ss"`). @default "minute" */
  granularity?: TimeGranularity;
  /** A 12- or 24-hour clock. @default the locale's */
  hourCycle?: 12 | 24;
  /** The earliest valid time (`"HH:mm[:ss]"`); an earlier one is shown as invalid. */
  min?: string;
  /**
   * The latest valid time; a later one is shown as invalid. Must not be before `min` (no
   * overnight ranges: a dev warning, then `max` is ignored).
   */
  max?: string;
  /**
   * The step in seconds, counted from `min` (native `<input type="time">` semantics): the arrow
   * keys land on its grid, and a time off it is invalid. @default 60, or 1 at second granularity
   * (as a native time input shows seconds only with `step` below 60)
   */
  step?: number;
  /**
   * BCP 47 locale for the segment order, hour cycle, digits, names and direction.
   * @default the document's `lang`, else the browser's
   *
   * Required when server-rendering: the default reads `document.documentElement.lang` on the
   * client only, and a server and client that disagree on the hour cycle render a different
   * number of segments, so hydration fails (not just a text patch).
   */
  locale?: string;
  /** Disables every segment (a disabled `Field` does too). */
  disabled?: boolean;
  /** Keeps the segments focusable but ignores edits. */
  readOnly?: boolean;
  /** Requires a complete time to submit (marks the segments `aria-required`). */
  required?: boolean;
  /**
   * Submits the value (empty when unset) through a visually hidden input under this name, else
   * the Field's; in a `Form`, `onFormSubmit` reports it under the Field's name (else this one).
   */
  name?: string;
  /** The `id` of a `<form>` elsewhere in the document to submit with. */
  form?: string;
  /** Height, padding and text size, as Input and Select. @default "md" */
  size?: keyof typeof textFieldSizes;
  /** Translated segment names, empty text and validation messages. */
  labels?: TimeFieldLabels;
  /**
   * @internal For TimePicker. The elements that together form the control (the field plus its
   * icon button and popup): the Field's focused / touched state and `onBlur` validation follow
   * focus entering and leaving them as a whole (see `useFocusScope`).
   */
  focusScope?: () => (Element | null)[];
}

/** `value` at `granularity` (seconds dropped or added), or `null` when it does not parse. */
function normalizeTime(value: string | null, granularity: TimeGranularity): string | null {
  const parts = value === null ? null : parseTime(value);
  return parts ? formatTimeValue(parts, granularity) : null;
}

function stepMessage(step: number, labels: TimeFieldLabels | undefined): string {
  if (labels?.stepMismatch) return labels.stepMismatch(step);
  return step % 60 === 0
    ? `Enter a time in ${step / 60}-minute steps.`
    : `Enter a time in ${step}-second steps.`;
}

/**
 * A typed, segmented time input (React Aria's date-field pattern): a `group` of `spinbutton`
 * segments (hour, minute, second, day period) in the locale's order. Digits type with
 * auto-advance, ↑/↓ step on the `step` grid with wrap, PageUp / PageDown step further, Home / End
 * jump to the bounds, `a` / `p` set the day period, Backspace / Delete clear, ←/→ move to the
 * visual neighbour and Tab through the segments, the separator advances, and pasting a time fills
 * every segment. Name it with a `Field` label, `aria-labelledby` or `aria-label`.
 */
export function TimeField({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  granularity = "minute",
  hourCycle: hourCycleProp,
  min,
  max: maxProp,
  step = granularity === "second" ? 1 : 60,
  locale: localeProp,
  disabled: disabledProp,
  readOnly = false,
  required,
  name,
  form,
  size,
  labels,
  focusScope,
  ref,
  id: idProp,
  className,
  // Moved to the segments (the spinbuttons are what is invalid), not left on the group.
  "aria-invalid": ariaInvalid,
  ...props
}: TimeFieldProps) {
  const field = useFieldRootContext();
  const { labelId: fieldLabelId, getDescriptionProps } = useLabelableContext();
  // The group is named by `aria-labelledby`, so the FieldLabel must not point `for` at it.
  useLabelableId({ id: null });
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRootRef = useMergedRefs(rootRef, ref);

  const locale = resolveLocale(localeProp) ?? new Intl.DateTimeFormat().resolvedOptions().locale;
  const hourCycle = resolveHourCycle(locale, hourCycleProp);
  const [rawValue, setValue] = useControllableState(valueProp, defaultValue);
  const value = normalizeTime(rawValue, granularity);

  const overnight = min !== undefined && maxProp !== undefined && compareTime(min, maxProp) > 0;
  const max = overnight ? undefined : maxProp;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (rawValue !== null && parseTime(rawValue) === null) {
      console.warn(
        `TimeField: ignoring the value ${JSON.stringify(rawValue)}; pass "HH:mm" or "HH:mm:ss".`,
      );
    }
  }, [rawValue]);
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !overnight) return;
    console.warn(
      `TimeField: min (${min}) is after max (${maxProp}); overnight ranges are not supported, so max is ignored.`,
    );
  }, [overnight, min, maxProp]);

  const disabled = !!disabledProp || field.state.disabled;
  const editable = !disabled && !readOnly;
  const formatBound = (bound: string) =>
    formatTime(bound, locale, { hourCycle: hourCycleProp, granularity });
  let rangeMessage = "";
  if (value !== null) {
    if (min !== undefined && compareTime(value, min) < 0) {
      const text = formatBound(min);
      rangeMessage = labels?.rangeUnderflow?.(text) ?? `Enter a time at or after ${text}.`;
    } else if (max !== undefined && compareTime(value, max) > 0) {
      const text = formatBound(max);
      rangeMessage = labels?.rangeOverflow?.(text) ?? `Enter a time at or before ${text}.`;
    } else if (timeStepMismatch(value, { step, min })) {
      rangeMessage = stepMessage(step, labels);
    }
  }
  const invalid =
    field.state.valid === false ||
    rangeMessage !== "" ||
    ariaInvalid === true ||
    ariaInvalid === "true";

  const ariaLabelledBy =
    props["aria-labelledby"] ?? (props["aria-label"] ? undefined : fieldLabelId);
  // What names the field, for each segment's `aria-labelledby`: the labelling ids, or the group
  // itself when it is named by `aria-label`.
  const segmentLabelSource = ariaLabelledBy ?? (props["aria-label"] ? id : undefined);
  const { "aria-describedby": ariaDescribedBy } = getDescriptionProps({
    "aria-describedby": props["aria-describedby"],
  });

  const requestSubmit = useSubmitOnEnter(rootRef);
  const control = useTimeSegments({
    id,
    value,
    onChange: (next) => {
      setValue(next);
      onValueChange?.(next);
    },
    locale,
    hourCycle,
    granularity,
    step,
    min,
    labels,
    disabled,
    readOnly,
    required,
    invalid,
    labelSource: segmentLabelSource,
    containerRef: rootRef,
    onEnter: requestSubmit,
  });

  // Form focuses the first segment of an invalid field.
  const firstSegmentRef = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return rootRef.current?.querySelector<HTMLElement>(timeSegmentSelector) ?? null;
      },
    }),
    [],
  );
  const formControl = useFormControl({
    slot: "time-form-control",
    value,
    inputValue: value ?? "",
    formValue: value ?? "",
    name: name ?? field.name,
    registrationName: name,
    form,
    required,
    disabled,
    readOnly,
    customValidity: control.partial
      ? (labels?.incomplete ?? "Enter a complete time.")
      : rangeMessage,
    controlRef: firstSegmentRef,
  });

  // The boundary is the group, or the `focusScope` (TimePicker's field, button and popup).
  useFocusScope(() => focusScope?.() ?? [rootRef.current], formControl.onFocus, formControl.onBlur);

  useLabelFocusesFirstEmpty(fieldLabelId, rootRef, timeSegmentSelector);

  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: React Aria's pattern is a div group; a <fieldset> brings UA borders, padding and min-width, and names itself from a <legend>, not the Field label. */}
      <div
        {...props}
        ref={setRootRef}
        id={id}
        role="group"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        data-slot="time-field"
        data-size={size ?? "md"}
        data-invalid={invalid ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        data-readonly={readOnly ? "" : undefined}
        className={cn(segmentGroupBase, textFieldSizes[size ?? "md"], className)}
        onMouseDown={(event) => {
          props.onMouseDown?.(event);
          handleGroupMouseDown(event, disabled, timeSegmentSelector);
        }}
        onPaste={(event) => {
          props.onPaste?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          if (!editable) return;
          const pasted = normalizeTime(
            parseTimeString(event.clipboardData.getData("text"), locale, hourCycle),
            granularity,
          );
          if (pasted) control.fill(pasted);
        }}
      >
        {control.segments}
      </div>
      {formControl.input}
    </>
  );
}
