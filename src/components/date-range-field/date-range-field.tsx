"use client";

/*
 * Two DateFields in one group (spec Phase I §1): the start and end segment sets come from the
 * segment engine DateField uses (`../date-field/date-segments-control.tsx`), and the Field /
 * Form wiring is DateField's (the labelable context with a `null` control id, one registered
 * control through `useDateFormControl`, one `useFocusScope` boundary around both halves).
 */
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useLabelableContext, useLabelableId } from "@base-ui/react/internals/labelable-provider";
import { type ComponentProps, type RefObject, useId, useMemo, useRef } from "react";
import { cn } from "../../lib/cn";
import { compareDay, resolveLocale, toISODate } from "../../lib/date";
import { parseDateRangeString, parseDateString } from "../../lib/date-segments";
import { useControllableState } from "../../lib/use-controllable-state";
import { useMergedRefs } from "../../lib/use-merged-refs";
import { type DateRange, emptyRange } from "../calendar/calendar";
import type { DateFieldLabels } from "../date-field/date-field";
import {
  dateGroupBase,
  handleGroupMouseDown,
  sameDate,
  segmentSelector,
  useDateSegments,
  useLabelFocusesFirstEmpty,
  useSubmitOnEnter,
} from "../date-field/date-segments-control";
import {
  dateValidationMessage,
  useDateFormControl,
  useFocusScope,
} from "../date-picker/date-form-control";
import { textFieldSizes } from "../input/input-variants";

/** Translatable strings: the halves' names, the segments' and the validation messages. */
export interface DateRangeFieldLabels extends Omit<DateFieldLabels, "incomplete"> {
  /** The start half's name (followed by the field's). @default "Start date" */
  start?: string;
  /** The end half's name (followed by the field's). @default "End date" */
  end?: string;
  /**
   * The validation message while a half is partly typed or only one end is set.
   * @default "Enter a complete date range."
   */
  incomplete?: string;
  /** The validation message for an end before the start. @default "The end date must be on or after the start date." */
  rangeReversed?: string;
}

export interface DateRangeFieldProps
  extends Omit<ComponentProps<"div">, "defaultValue" | "onChange" | "children"> {
  /** The range, controlled. */
  value?: DateRange;
  /** The initial range. @default { start: null, end: null } */
  defaultValue?: DateRange;
  /**
   * Called with the pair when either half changes to a complete valid date, or to `null` when
   * the user clears a segment of a complete one. Partial input never calls it.
   */
  onValueChange?: (value: DateRange) => void;
  /** The earliest valid day for either end; an earlier date is shown as invalid. */
  min?: Date | null;
  /** The latest valid day for either end; a later date is shown as invalid. */
  max?: Date | null;
  /** Marks individual days invalid as an end (the days between the ends are not checked). */
  isDateDisabled?: (date: Date) => boolean;
  /**
   * BCP 47 locale for the segment order, digits, names and placeholders.
   * @default the document's `lang`, else the browser's
   *
   * Pass it explicitly when server-rendering (see DateField's `locale`).
   */
  locale?: string;
  /** Disables every segment (a disabled `Field` does too). */
  disabled?: boolean;
  /** Keeps the segments focusable but ignores edits. */
  readOnly?: boolean;
  /** Requires both dates to submit (marks the segments `aria-required`). */
  required?: boolean;
  /**
   * Submits the range as the ISO interval `YYYY-MM-DD/YYYY-MM-DD` (empty until both ends are set)
   * through the visually hidden validating input. In a `Field` and `Form`, `onFormSubmit` reports
   * `{ start, end }` under the Field's name (else this one); the Field's name adds no native
   * entry (as DateRangePicker).
   */
  name?: string;
  /** Submits the start as `YYYY-MM-DD` (empty when unset) through a hidden input. */
  startName?: string;
  /** Submits the end as `YYYY-MM-DD` (empty when unset) through a hidden input. */
  endName?: string;
  /** Height, padding and text size, as Input and Select. @default "md" */
  size?: keyof typeof textFieldSizes;
  /** Translated half names, segment names, empty text and validation messages. */
  labels?: DateRangeFieldLabels;
  /**
   * @internal For `DateRangePicker editable`: the elements that together form the control (see
   * DateField's `focusScope`).
   */
  focusScope?: () => (Element | null)[];
}

const halfBase = "inline-flex items-center gap-0.5";
const separatorBase = "px-1 text-muted-foreground";

/**
 * A typed date range: one group holding a start and an end DateField segment set with an en dash
 * between them. The segments type and step as DateField's; ←/→ (flipped in RTL) and the
 * auto-advance run across both halves, so typing a complete start date moves on into the end.
 * Pasting a range ("2026-09-01 – 2026-09-12", "2026-09-01/2026-09-12", or two locale dates
 * separated by a dash or "to") fills both halves; a single date fills the half it is pasted
 * into. An end before the start is invalid, never swapped. Name it with a `Field` label,
 * `aria-labelledby` or `aria-label`.
 */
export function DateRangeField({
  value: valueProp,
  defaultValue = emptyRange,
  onValueChange,
  min,
  max,
  isDateDisabled,
  locale: localeProp,
  disabled: disabledProp,
  readOnly = false,
  required,
  name,
  startName,
  endName,
  size,
  labels,
  focusScope,
  ref,
  id: idProp,
  className,
  // Moved to the segments (the spinbuttons are what is invalid), not left on the group.
  "aria-invalid": ariaInvalid,
  ...props
}: DateRangeFieldProps) {
  const field = useFieldRootContext();
  const { labelId: fieldLabelId, getDescriptionProps } = useLabelableContext();
  // The group is named by `aria-labelledby`, so the FieldLabel must not point `for` at it.
  useLabelableId({ id: null });
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const startId = `${id}-start`;
  const endId = `${id}-end`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRootRef = useMergedRefs(rootRef, ref);
  const startRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const locale = resolveLocale(localeProp);
  const [value, setValue] = useControllableState(valueProp, defaultValue);
  // The pair as last reported, so a half reports its change alongside the other's latest value.
  const latestRef = useRef(value);
  latestRef.current = value;
  const { start, end } = value;

  const disabled = !!disabledProp || field.state.disabled;
  const editable = !disabled && !readOnly;
  // Only the ends are checked (as DateRangePicker: a range may span disabled days).
  const bounds = { min, max, isDateDisabled };
  const rangeMessage =
    dateValidationMessage(start, bounds, labels, locale) ||
    dateValidationMessage(end, bounds, labels, locale);
  const reversed = !!start && !!end && compareDay(end, start) < 0;
  const invalid =
    field.state.valid === false ||
    rangeMessage !== "" ||
    reversed ||
    ariaInvalid === true ||
    ariaInvalid === "true";

  const ariaLabelledBy =
    props["aria-labelledby"] ?? (props["aria-label"] ? undefined : fieldLabelId);
  // What names the field: the labelling ids, or the group itself when it is named by `aria-label`.
  const fieldLabelSource = ariaLabelledBy ?? (props["aria-label"] ? id : undefined);
  const { "aria-describedby": ariaDescribedBy } = getDescriptionProps({
    "aria-describedby": props["aria-describedby"],
  });
  /** A half is named by its own label followed by the field's ("Start date Stay"). */
  const halfLabelledBy = (halfId: string) =>
    fieldLabelSource ? `${halfId} ${fieldLabelSource}` : undefined;

  const emit = (next: DateRange) => {
    latestRef.current = next;
    setValue(next);
    onValueChange?.(next);
  };

  const requestSubmit = useSubmitOnEnter(rootRef);
  const shared = {
    locale,
    labels,
    disabled,
    readOnly,
    required,
    invalid,
    navigationRef: rootRef,
    onEnter: requestSubmit,
  };
  const startControl = useDateSegments({
    ...shared,
    id: startId,
    value: start,
    onChange: (date) => emit({ ...latestRef.current, start: date }),
    // "month Start date Stay": the segment, its half, then the field.
    labelSource: `${startId}${fieldLabelSource ? ` ${fieldLabelSource}` : ""}`,
    containerRef: startRef,
  });
  const endControl = useDateSegments({
    ...shared,
    id: endId,
    value: end,
    onChange: (date) => emit({ ...latestRef.current, end: date }),
    labelSource: `${endId}${fieldLabelSource ? ` ${fieldLabelSource}` : ""}`,
    containerRef: endRef,
    alignFirst: false,
  });

  const startISO = start ? toISODate(start) : "";
  const endISO = end ? toISODate(end) : "";
  const incomplete = startControl.partial || endControl.partial || !start !== !end;
  const customValidity = incomplete
    ? (labels?.incomplete ?? "Enter a complete date range.")
    : rangeMessage ||
      (reversed
        ? (labels?.rangeReversed ?? "The end date must be on or after the start date.")
        : "");

  // Form focuses the first segment of an invalid field.
  const firstSegmentRef = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return rootRef.current?.querySelector<HTMLElement>(segmentSelector) ?? null;
      },
    }),
    [],
  );
  // One Field control (a Field registers one), as DateRangePicker: the validating input holds the
  // ISO interval (empty until both are set, so `required` needs both), `onFormSubmit` gets
  // `{ start, end }`, and the named start / end inputs keep native FormData.
  const formControl = useDateFormControl({
    value,
    inputValue: start && end ? `${startISO}/${endISO}` : "",
    formValue: { start: startISO, end: endISO },
    name,
    registrationName: name,
    required,
    disabled,
    readOnly,
    customValidity,
    controlRef: firstSegmentRef,
  });

  // Both halves (plus the editable picker's button and popup) are one boundary: moving between
  // the halves is neither a focus nor a blur.
  useFocusScope(() => focusScope?.() ?? [rootRef.current], formControl.onFocus, formControl.onBlur);

  useLabelFocusesFirstEmpty(fieldLabelId, rootRef);

  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: as DateField, a div group (a <fieldset> brings UA styles and names itself from a <legend>). */}
      <div
        {...props}
        ref={setRootRef}
        id={id}
        role="group"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        data-slot="date-range-field"
        data-size={size ?? "md"}
        data-invalid={invalid ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        data-readonly={readOnly ? "" : undefined}
        className={cn(dateGroupBase, textFieldSizes[size ?? "md"], className)}
        onMouseDown={(event) => {
          props.onMouseDown?.(event);
          handleGroupMouseDown(event, disabled);
        }}
        onPaste={(event) => {
          props.onPaste?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          if (!editable) return;
          const text = event.clipboardData.getData("text");
          const pasted = parseDateRangeString(text, locale);
          if (pasted) {
            // Both halves show it, and the pair is reported once.
            startControl.fill(pasted.start, false);
            endControl.fill(pasted.end, false);
            if (!sameDate(pasted.start, start) || !sameDate(pasted.end, end)) emit(pasted);
            return;
          }
          const date = parseDateString(text, locale);
          if (!date) return;
          const inEnd = !!(event.target as Element).closest("[data-slot=date-range-field-end]");
          (inEnd ? endControl : startControl).fill(date);
        }}
      >
        {/* biome-ignore lint/a11y/useSemanticElements: a named sub-group of the segments, as the outer group. */}
        <div
          ref={startRef}
          id={startId}
          role="group"
          aria-label={labels?.start ?? "Start date"}
          aria-labelledby={halfLabelledBy(startId)}
          data-slot="date-range-field-start"
          className={halfBase}
        >
          {startControl.segments}
        </div>
        <span aria-hidden="true" data-slot="date-range-field-separator" className={separatorBase}>
          –
        </span>
        {/* biome-ignore lint/a11y/useSemanticElements: a named sub-group of the segments, as the outer group. */}
        <div
          ref={endRef}
          id={endId}
          role="group"
          aria-label={labels?.end ?? "End date"}
          aria-labelledby={halfLabelledBy(endId)}
          data-slot="date-range-field-end"
          className={halfBase}
        >
          {endControl.segments}
        </div>
      </div>
      {formControl.input}
      {startName && <input type="hidden" name={startName} value={startISO} />}
      {endName && <input type="hidden" name={endName} value={endISO} />}
    </>
  );
}
