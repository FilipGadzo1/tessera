"use client";

/*
 * Form and Field participation for the date controls (spec Phase H §3). The hidden-input recipe
 * (Base UI Select's) and the focus scope live in `../field/form-control.tsx`, shared with the other
 * controls that have no native input of their own (Phase J); this file adds the date validation
 * and names the hidden input's `data-slot`.
 */
import { compareDay } from "../../lib/date";
import { type FormControlOptions, useFocusScope, useFormControl } from "../field/form-control";

export { useFocusScope };

/** Validation messages for a date outside the allowed days. */
export interface DateValidationLabels {
  /**
   * The message for a date before `min`, given `min` formatted and as a `Date` (to format it
   * another way).
   * @default (min) => `Enter a date on or after ${min}.`
   */
  rangeUnderflow?: (min: string, date: Date) => string;
  /**
   * The message for a date after `max`, given `max` formatted and as a `Date`.
   * @default (max) => `Enter a date on or before ${max}.`
   */
  rangeOverflow?: (max: string, date: Date) => string;
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
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", calendar: "gregory" }).format(bound);
  if (min && compareDay(date, min) < 0) {
    const text = format(min);
    return labels?.rangeUnderflow?.(text, min) ?? `Enter a date on or after ${text}.`;
  }
  if (max && compareDay(date, max) > 0) {
    const text = format(max);
    return labels?.rangeOverflow?.(text, max) ?? `Enter a date on or before ${text}.`;
  }
  if (isDateDisabled?.(date)) return labels?.unavailable ?? "This date is unavailable.";
  return "";
}

/** `useFormControl`'s options; the date controls' hidden input is `data-slot="date-form-control"`. */
export type DateFormControlOptions = Omit<FormControlOptions, "slot">;

/** `useFormControl` for a date control (its input's value is `YYYY-MM-DD`, or `""`). */
export function useDateFormControl(options: DateFormControlOptions) {
  return useFormControl({ ...options, slot: "date-form-control" });
}
