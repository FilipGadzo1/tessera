"use client";

import { useRegisterFieldControl } from "@base-ui/react/internals/field-register-control";
/*
 * Form and Field participation for the date controls (spec Phase H §3), following Base UI's own
 * Select recipe (`select/root/SelectRoot.js`): a visually hidden real `<input>` (not
 * `type="hidden"`, which is barred from constraint validation) carries the value, `required` and a
 * custom validity, and the control registers with the Field through `useRegisterFieldControl`.
 * Form focuses the registered `controlRef` (the visible control) on an invalid submit; the input
 * forwards any focus it gets there too, as Select's does.
 *
 * Three Base UI internals (exported by the package, not documented) are used, under the same
 * `~1.8.0` pin as the Field wiring: `field-root-context` (validation, dirty / filled / touched),
 * `field-register-control` (the registration) and `form-context` (`clearErrors`, which Select
 * calls so a Form `errors[name]` clears when the value changes).
 */
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useFormContext } from "@base-ui/react/internals/form-context";
import {
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
} from "react";
import { compareDay } from "../../lib/date";

/*
 * Copied from `@base-ui/utils/visuallyHidden` (0.4.0), which Base UI's Select uses. That package is
 * only a transitive dependency of `@base-ui/react`, so importing it could fail to resolve in a
 * consumer's install (e.g. pnpm's strict layout).
 */
const visuallyHiddenBase: CSSProperties = {
  clipPath: "inset(50%)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  border: 0,
  padding: 0,
  width: 1,
  height: 1,
  margin: -1,
};
/** For a named input: stays next to its control, so a native validation bubble points there. */
const visuallyHiddenInput: CSSProperties = { ...visuallyHiddenBase, position: "absolute" };
/** For an unnamed input: out of the flow entirely. */
const visuallyHidden: CSSProperties = { ...visuallyHiddenBase, position: "fixed", top: 0, left: 0 };

/** Validation messages for a date outside the allowed days. */
export interface DateValidationLabels {
  /** The message for a date before `min`. @default (min) => `Enter a date on or after ${min}.` */
  rangeUnderflow?: (min: string) => string;
  /** The message for a date after `max`. @default (max) => `Enter a date on or before ${max}.` */
  rangeOverflow?: (max: string) => string;
  /** The message for a day `isDateDisabled` rejects. @default "This date is unavailable." */
  unavailable?: string;
}

export interface DateBounds {
  min?: Date | null;
  max?: Date | null;
  isDateDisabled?: (date: Date) => boolean;
}

/**
 * The custom validity for `date` against the bounds, or `""` when it is allowed (or empty). The
 * bounds in a message are formatted with `dateStyle: "medium"` in `locale`.
 */
export function dateValidationMessage(
  date: Date | null,
  { min, max, isDateDisabled }: DateBounds,
  labels: DateValidationLabels | undefined,
  locale: string | undefined,
): string {
  if (!date) return "";
  const format = (bound: Date) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(bound);
  if (min && compareDay(date, min) < 0) {
    const text = format(min);
    return labels?.rangeUnderflow?.(text) ?? `Enter a date on or after ${text}.`;
  }
  if (max && compareDay(date, max) > 0) {
    const text = format(max);
    return labels?.rangeOverflow?.(text) ?? `Enter a date on or before ${text}.`;
  }
  if (isDateDisabled?.(date)) return labels?.unavailable ?? "This date is unavailable.";
  return "";
}

export interface DateFormControlOptions {
  /** The value Field `validate` receives (and dirty state compares), e.g. `Date | null`. */
  value: unknown;
  /** The input's value: `YYYY-MM-DD`, or `""` while there's no complete value (`required` reads it). */
  inputValue: string;
  /** The value `onFormSubmit` reports under the field's name. */
  formValue: unknown;
  /** The input's name for native FormData; unnamed when omitted. */
  name?: string;
  /** The name `onFormSubmit` falls back to when the Field has none. */
  registrationName?: string;
  required?: boolean;
  disabled: boolean;
  readOnly?: boolean;
  /** A custom validity message, `""` when valid. */
  customValidity: string;
  /** The visible control Form's focus-first-invalid focuses (a trigger, a segment). */
  controlRef: RefObject<HTMLElement | null>;
}

/**
 * Joins a date control to its Field and Form. Returns the hidden input to render, and focus / blur
 * handlers for the visible control's outer boundary (they mark the Field focused / touched and run
 * `validationMode="onBlur"` validation).
 */
export function useDateFormControl({
  value,
  inputValue,
  formValue,
  name,
  registrationName,
  required,
  disabled,
  readOnly,
  customValidity,
  controlRef,
}: DateFormControlOptions): {
  input: ReactNode;
  onFocus: () => void;
  onBlur: () => void;
} {
  const { clearErrors } = useFormContext();
  const field = useFieldRootContext();
  const { validation, setDirty, setFilled, setTouched, setFocused, validationMode } = field;
  const id = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const formValueRef = useRef(formValue);
  formValueRef.current = formValue;
  const getFormValue = useCallback(() => formValueRef.current, []);
  useRegisterFieldControl(controlRef, id, value, getFormValue, !disabled, registrationName);

  // Before the change handling below: validation reads the input's validity synchronously.
  useLayoutEffect(() => {
    inputRef.current?.setCustomValidity(customValidity);
  }, [customValidity]);

  useLayoutEffect(() => {
    setFilled(inputValue !== "");
  }, [inputValue, setFilled]);

  // Select's `useValueChanged` handling, keyed by the string form (a new Date for the same day is
  // no change): clear the Form's server error, update dirty, and let the Field validate.
  const initialValueRef = useRef(inputValue);
  const previousValueRef = useRef(inputValue);
  useLayoutEffect(() => {
    if (previousValueRef.current === inputValue) return;
    previousValueRef.current = inputValue;
    clearErrors(field.name);
    setDirty(inputValue !== initialValueRef.current);
    validation.change(value);
  });

  const setRef = useCallback(
    (element: HTMLInputElement | null) => {
      inputRef.current = element;
      validation.inputRef.current = element;
    },
    [validation.inputRef],
  );

  const input = (
    <input
      {...validation.getValidationProps(disabled, {
        onFocus() {
          // Form (or a native validation bubble) focused the input: move to the visible control.
          controlRef.current?.focus({ focusVisible: true } as FocusOptions);
        },
      })}
      ref={setRef}
      name={name}
      value={inputValue}
      // The value only changes through the visible control (no autofill support).
      onChange={() => {}}
      disabled={disabled}
      required={required}
      readOnly={readOnly}
      style={name ? visuallyHiddenInput : visuallyHidden}
      tabIndex={-1}
      aria-hidden
      data-slot="date-form-control"
    />
  );

  return {
    input,
    onFocus: () => setFocused(true),
    onBlur: () => {
      setTouched(true);
      setFocused(false);
      if (validationMode === "onBlur") validation.commit(value);
    },
  };
}

/** Whether focus moving to `event.relatedTarget` leaves every one of `containers`. */
export function focusLeaves(event: FocusEvent, ...containers: (Element | null | undefined)[]) {
  const next = event.relatedTarget as Node | null;
  return !containers.some((container) => container && next && container.contains(next));
}
