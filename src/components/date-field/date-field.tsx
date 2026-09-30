"use client";

/*
 * Field wiring goes through the same two Base UI internals DatePicker uses (see date-picker.tsx):
 * the Field root context (disabled / invalid state) and the labelable context (the label's id and
 * the description ids). The group isn't a labelable element, so — like Base UI's CheckboxGroup —
 * it registers a `null` control id (the FieldLabel then omits `for`) and takes its name from
 * `aria-labelledby` instead. Form and Field validation go through the shared date form control
 * (`../date-picker/date-form-control.tsx`). The segments and their keyboard are the shared
 * engine in `./date-segments-control.tsx` (DateRangeField uses it too).
 */
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useLabelableContext, useLabelableId } from "@base-ui/react/internals/labelable-provider";
import { type ComponentProps, type RefObject, useId, useMemo, useRef } from "react";
import { cn } from "../../lib/cn";
import { resolveLocale, toISODate } from "../../lib/date";
import { parseDateString } from "../../lib/date-segments";
import { useControllableState } from "../../lib/use-controllable-state";
import { useMergedRefs } from "../../lib/use-merged-refs";
import {
  type DateValidationLabels,
  dateValidationMessage,
  useDateFormControl,
  useFocusScope,
} from "../date-picker/date-form-control";
import { textFieldSizes } from "../input/input-variants";
import {
  type DateSegmentLabels,
  dateGroupBase,
  handleGroupMouseDown,
  segmentSelector,
  useDateSegments,
  useLabelFocusesFirstEmpty,
  useSubmitOnEnter,
} from "./date-segments-control";

/**
 * Translatable strings for the segments' accessible names, the empty value text and the
 * validation messages.
 */
export interface DateFieldLabels extends DateValidationLabels, DateSegmentLabels {
  /** The validation message while only some segments are filled. @default "Enter a complete date." */
  incomplete?: string;
}

export interface DateFieldProps
  extends Omit<ComponentProps<"div">, "defaultValue" | "onChange" | "children"> {
  /** The date, controlled (`null` for none). */
  value?: Date | null;
  /** The initial date. @default null */
  defaultValue?: Date | null;
  /**
   * Called with the date once all segments form a valid day, and with `null` when the user
   * clears a segment of a complete date. Partial input never calls it.
   */
  onValueChange?: (value: Date | null) => void;
  /** The earliest valid day; an earlier date is shown as invalid. */
  min?: Date | null;
  /** The latest valid day; a later date is shown as invalid. */
  max?: Date | null;
  /** Marks individual days invalid (returns `true` for a disallowed day). */
  isDateDisabled?: (date: Date) => boolean;
  /**
   * BCP 47 locale for the segment order, digits, names and placeholders.
   * @default the document's `lang`, else the browser's
   *
   * Pass it explicitly when server-rendering: the default reads `document.documentElement.lang`
   * on the client only, which can disagree with the server and cause a hydration mismatch.
   */
  locale?: string;
  /** Disables every segment (a disabled `Field` does too). */
  disabled?: boolean;
  /** Keeps the segments focusable but ignores edits. */
  readOnly?: boolean;
  /** Requires a complete date to submit (marks the segments `aria-required`). */
  required?: boolean;
  /**
   * Submits the value as `YYYY-MM-DD` (empty when unset) through a visually hidden input; in a
   * `Field` and `Form`, `onFormSubmit` reports it under the Field's name (else this one).
   */
  name?: string;
  /** Height, padding and text size, as Input and Select. @default "md" */
  size?: keyof typeof textFieldSizes;
  /** Translated segment names, empty text and validation messages. */
  labels?: DateFieldLabels;
  /**
   * @internal For `DatePicker editable`. The elements that together form the control (the field
   * plus its icon button and popup): the Field's focused / touched state and `onBlur` validation
   * follow focus entering and leaving them as a whole, not the segments' group alone. The first
   * is the main element (the field and its button), a later one the popup (see `useFocusScope`).
   */
  focusScope?: () => (Element | null)[];
}

/**
 * A typed, segmented date input (React Aria's date-field pattern): a `group` of `spinbutton`
 * segments in the locale's order. Digits type with auto-advance, ↑/↓ step with wrap, PageUp /
 * PageDown step further, Home / End jump to the bounds, Backspace / Delete clear, ←/→ (flipped
 * in RTL) and Tab move between segments, the literal separator advances, and pasting a date in
 * the locale's format or ISO fills every segment. Name it with a `Field` label, `aria-labelledby`
 * or `aria-label`.
 */
export function DateField({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  min,
  max,
  isDateDisabled,
  locale: localeProp,
  disabled: disabledProp,
  readOnly = false,
  required,
  name,
  size,
  labels,
  focusScope,
  ref,
  id: idProp,
  className,
  // Moved to the segments (the spinbuttons are what is invalid), not left on the group.
  "aria-invalid": ariaInvalid,
  ...props
}: DateFieldProps) {
  const field = useFieldRootContext();
  const { labelId: fieldLabelId, getDescriptionProps } = useLabelableContext();
  // The group is named by `aria-labelledby`, so the FieldLabel must not point `for` at it.
  useLabelableId({ id: null });
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRootRef = useMergedRefs(rootRef, ref);

  const locale = resolveLocale(localeProp);
  const [value, setValue] = useControllableState(valueProp, defaultValue);

  const disabled = !!disabledProp || field.state.disabled;
  const editable = !disabled && !readOnly;
  const rangeMessage = dateValidationMessage(value, { min, max, isDateDisabled }, labels, locale);
  const outOfRange = rangeMessage !== "";
  const invalid =
    field.state.valid === false || outOfRange || ariaInvalid === true || ariaInvalid === "true";

  const ariaLabelledBy =
    props["aria-labelledby"] ?? (props["aria-label"] ? undefined : fieldLabelId);
  // What names the field, for each segment's `aria-labelledby`: the labelling ids, or the group
  // itself when it is named by `aria-label`.
  const segmentLabelSource = ariaLabelledBy ?? (props["aria-label"] ? id : undefined);
  const { "aria-describedby": ariaDescribedBy } = getDescriptionProps({
    "aria-describedby": props["aria-describedby"],
  });

  const requestSubmit = useSubmitOnEnter(rootRef);
  const control = useDateSegments({
    id,
    value,
    onChange: (date) => {
      setValue(date);
      onValueChange?.(date);
    },
    locale,
    labels,
    disabled,
    readOnly,
    required,
    invalid,
    labelSource: segmentLabelSource,
    containerRef: rootRef,
    navigationRef: rootRef,
    onEnter: requestSubmit,
  });

  // Form focuses the first segment of an invalid field.
  const firstSegmentRef = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return rootRef.current?.querySelector<HTMLElement>(segmentSelector) ?? null;
      },
    }),
    [],
  );
  const formControl = useDateFormControl({
    value,
    inputValue: value ? toISODate(value) : "",
    formValue: value ? toISODate(value) : "",
    name: name ?? field.name,
    registrationName: name,
    required,
    disabled,
    readOnly,
    customValidity: control.partial
      ? (labels?.incomplete ?? "Enter a complete date.")
      : rangeMessage,
    controlRef: firstSegmentRef,
  });

  // The boundary is the group, or the `focusScope` (the editable DatePicker's field, button and
  // popup), under the date controls' one blur rule.
  useFocusScope(() => focusScope?.() ?? [rootRef.current], formControl.onFocus, formControl.onBlur);

  useLabelFocusesFirstEmpty(fieldLabelId, rootRef);

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
        data-slot="date-field"
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
          const date = parseDateString(event.clipboardData.getData("text"), locale);
          if (date) control.fill(date);
        }}
      >
        {control.segments}
      </div>
      {formControl.input}
    </>
  );
}
