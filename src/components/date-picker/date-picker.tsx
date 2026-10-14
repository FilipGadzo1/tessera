"use client";

/*
 * Field wiring goes through two Base UI internals (exported by the package, not documented): the
 * Field root context (disabled / invalid state) and the labelable context (the control id the
 * FieldLabel points at, the label's id, and the description ids). They are the same hooks Base UI's
 * own SelectTrigger uses; no public API lets a custom control join a Field. Form and Field
 * validation go through `date-form-control.tsx` (Base UI Select's hidden-input recipe).
 */
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useLabelableContext, useLabelableId } from "@base-ui/react/internals/labelable-provider";
import { type ComponentProps, type ReactNode, useId, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { compareDay, resolveLocale, toISODate, type WeekDay } from "../../lib/date";
import { CalendarIcon } from "../../lib/icons";
import { useControllableState } from "../../lib/use-controllable-state";
import { useMergedRefs } from "../../lib/use-merged-refs";
import {
  Calendar,
  type DateRange,
  emptyRange,
  RangeCalendar,
  type RangeCalendarProps,
} from "../calendar";
import type { CalendarLabels } from "../calendar/calendar-base";
import { DateField, type DateFieldLabels } from "../date-field/date-field";
import { DateRangeField, type DateRangeFieldLabels } from "../date-range-field/date-range-field";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { selectDefaults, selectTriggerVariants } from "../select";
import {
  type DateFormControlOptions,
  type DateValidationLabels,
  dateValidationMessage,
  useDateFormControl,
  useFocusScope,
} from "./date-form-control";
import { type EditableElementProps, EditableShell, type PickerOwnProps } from "./editable-shell";

/**
 * Translatable strings: the popup's name, the calendar's month buttons and the validation
 * messages (a value outside `min` / `max`, or a day `isDateDisabled` rejects).
 */
export interface DatePickerLabels
  extends CalendarLabels,
    DateValidationLabels,
    Pick<DateFieldLabels, "day" | "month" | "year" | "empty">,
    Pick<DateRangeFieldLabels, "start" | "end" | "rangeReversed"> {
  /** The popup dialog's accessible name. @default "Choose date" ("Choose date range" for DateRangePicker) */
  dialog?: string;
  /**
   * `editable`: the calendar icon button's accessible name.
   * @default "Choose date" ("Choose date range" for DateRangePicker)
   */
  openCalendar?: string;
  /**
   * DateRangePicker: the validation message while only one end is set. `editable` DatePicker:
   * while only some segments are filled. `editable` DateRangePicker: either.
   * @default "Choose both a start and an end date." ("Enter a complete date." for an `editable`
   * DatePicker, "Enter a complete date range." for an `editable` DateRangePicker)
   */
  incomplete?: string;
}

/** Trigger and popup props shared by `DatePicker` and `DateRangePicker`. */
interface PickerTriggerProps
  extends Omit<
      ComponentProps<"button">,
      "value" | "defaultValue" | "onChange" | "children" | "type" | "name" | "disabled"
    >,
    PickerOwnProps {}

/** Calendar and formatting props shared by `DatePicker` and `DateRangePicker`. */
interface PickerFields {
  /** Trigger text while nothing is picked. */
  placeholder?: string;
  /** How the trigger shows the value; the calendar is always Gregorian. @default { dateStyle: "medium" } */
  format?: Intl.DateTimeFormatOptions;
  /**
   * BCP 47 locale for the trigger text and the calendar.
   * @default the document's `lang`, else the browser's
   *
   * Pass it explicitly when server-rendering (see `Calendar`'s `locale` doc): the default reads
   * `document.documentElement.lang` on the client only, which can disagree with the server and
   * cause a hydration mismatch.
   */
  locale?: string;
  /** The earliest selectable day. */
  min?: Date | null;
  /** The latest selectable day. */
  max?: Date | null;
  /**
   * The month the calendar opens on while nothing is picked, e.g. decades back for a birthday.
   * Once a day is picked, the calendar opens on its month. @default today's month
   */
  defaultMonth?: Date;
  /** Disables individual days in the calendar (they stay focusable). */
  isDateDisabled?: (date: Date) => boolean;
  /** First day of the week, 0 = Sunday … 6 = Saturday. @default the locale's */
  weekStartsOn?: WeekDay;
  /** Translated labels. */
  labels?: DatePickerLabels;
}

const triggerExtras = "justify-start";
const valueBase = "min-w-0 truncate";
const iconBase = "size-4 shrink-0 text-muted-foreground";
const contentBase = "p-0 w-auto";

interface PickerShellProps extends PickerTriggerProps {
  /** The formatted value, or `null` to show the placeholder. */
  text: string | null;
  placeholder: string;
  dialogLabel: string;
  /** The Form / Field participation (the trigger is the control Form focuses). */
  formControl: Omit<DateFormControlOptions, "controlRef" | "disabled" | "required">;
  /** Extra native inputs (DateRangePicker's named start / end). */
  hiddenInputs?: ReactNode;
  /**
   * The value (an end, for a range) is outside `min` / `max` or on a disabled day: shown invalid at
   * once, the date family's one rule (as DateField), not only after validation.
   */
  outOfRange: boolean;
  /**
   * Renders the calendar: `close` asks to close the popup (focus returns to the trigger), `open`
   * is the effective open state (controlled or not).
   */
  renderCalendar: (close: () => void, open: boolean) => ReactNode;
}

/**
 * The trigger + popover shared by both pickers. Joins a Field: the FieldLabel names the trigger
 * (`<label for>` through the labelable id), FieldDescription describes it, and an invalid or
 * disabled Field marks it.
 */
function PickerShell({
  text,
  placeholder,
  dialogLabel,
  formControl: formControlOptions,
  hiddenInputs,
  outOfRange,
  renderCalendar,
  disabled,
  required,
  size,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  container,
  id: idProp,
  className,
  ref,
  ...props
}: PickerShellProps) {
  const field = useFieldRootContext();
  const { labelId: fieldLabelId, getDescriptionProps } = useLabelableContext();
  const id = useLabelableId({ id: idProp });
  const valueId = useId();
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const setTriggerRef = useMergedRefs(triggerRef, ref);

  const [open, setControllableOpen] = useControllableState(openProp, defaultOpen, onOpenChange);
  // Dedupe locally: the hook itself always calls onChange, but a Popover can re-request the
  // state it's already in (e.g. its own onOpenChange wrapper), and that must not re-fire
  // onOpenChange for callers relying on it only firing on an actual change.
  const setOpen = (next: boolean) => {
    if (next === open) return;
    setControllableOpen(next);
  };

  const isDisabled = !!disabled || field.state.disabled;
  const invalid = field.state.valid === false || outOfRange;
  const formControl = useDateFormControl({
    ...formControlOptions,
    required,
    disabled: isDisabled,
    controlRef: triggerRef,
  });
  // The trigger and the popup are one control for the Field's focus / blur.
  useFocusScope(
    () => [triggerRef.current, popupRef.current],
    formControl.onFocus,
    formControl.onBlur,
  );

  // The name is the label followed by the value ("Due date Sep 25, 2026"): on its own, a
  // <label for> or aria-label would replace the button's content — the value — as its name.
  const ariaLabel = props["aria-label"];
  const ariaLabelledByProp = props["aria-labelledby"];
  const labelSource = ariaLabelledByProp ?? (ariaLabel ? id : fieldLabelId);
  const ariaLabelledBy =
    labelSource && text !== null ? `${labelSource} ${valueId}` : ariaLabelledByProp;
  const { "aria-describedby": ariaDescribedBy } = getDescriptionProps({
    "aria-describedby": props["aria-describedby"],
  });

  return (
    <Popover open={open} onOpenChange={(next) => setOpen(next)}>
      <PopoverTrigger
        {...props}
        ref={setTriggerRef}
        id={id}
        type="button"
        disabled={isDisabled}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid ? true : props["aria-invalid"]}
        data-slot="date-picker-trigger"
        data-size={size ?? selectDefaults.size}
        data-placeholder={text === null ? "" : undefined}
        data-invalid={invalid ? "" : undefined}
        data-disabled={isDisabled ? "" : undefined}
        className={selectTriggerVariants({ size, className: cn(triggerExtras, className) })}
      >
        <CalendarIcon data-slot="date-picker-icon" className={iconBase} />
        <span
          id={valueId}
          data-slot="date-picker-value"
          className={cn(valueBase, text === null && "text-muted-foreground")}
        >
          {text ?? placeholder}
        </span>
      </PopoverTrigger>
      {formControl.input}
      {hiddenInputs}
      <PopoverContent
        ref={popupRef}
        container={container}
        align="start"
        sideOffset={6}
        aria-label={dialogLabel}
        data-slot="date-picker-content"
        className={contentBase}
        initialFocus={() => calendarInitialFocus(popupRef.current)}
      >
        {renderCalendar(() => setOpen(false), open)}
      </PopoverContent>
    </Popover>
  );
}

/** Focus the calendar's Tab stop (the selected day, else today), not the Previous button. */
const calendarInitialFocus = (popup: HTMLElement | null) =>
  popup?.querySelector<HTMLElement>('[data-slot="calendar-day"][tabindex="0"]') ?? true;

/** The editable pickers' shell props shared by DatePicker and DateRangePicker. */
const dateShellProps = {
  slotPrefix: "date-picker",
  icon: <CalendarIcon data-slot="date-picker-icon" />,
  initialFocus: calendarInitialFocus,
} as const;

interface DatePickerOwnProps extends PickerOwnProps, PickerFields {
  /** The picked day, controlled (`null` for none). */
  value?: Date | null;
  /** The initially picked day. @default null */
  defaultValue?: Date | null;
  /** Called with the day the user picks. */
  onValueChange?: (value: Date | null) => void;
  /**
   * Submits the value as `YYYY-MM-DD` (empty when unset) through a visually hidden input; in a
   * `Field` and `Form`, `onFormSubmit` reports it under the Field's name (else this one).
   * @default the Field's `name`
   */
  name?: string;
  /** @default "Pick a date" */
  placeholder?: string;
}

/** Native props of the default, button-trigger `DatePicker` (those of the `<button>`). */
export type DatePickerButtonProps = DatePickerOwnProps &
  Omit<PickerTriggerProps, keyof DatePickerOwnProps> & {
    /** @default false */
    editable?: false;
  };

/** Native props of the `editable` `DatePicker` (those of the DateField's group `<div>`). */
export type DatePickerEditableProps = DatePickerOwnProps &
  Omit<EditableElementProps, keyof DatePickerOwnProps> & {
    /**
     * Replaces the button trigger with a typed, segmented `DateField` and a calendar icon button
     * that opens the same popup. Typing a complete valid date updates the value (and the month the
     * calendar opens on); picking in the calendar fills the segments, closes it and returns focus to
     * the icon button. It joins a Field and Form as the DateField does. `placeholder` and `format`
     * are unused, and `ref`, `className`, `id` and the other native props go to the DateField's
     * group element. `readOnly` keeps the segments focusable and disables the icon button.
     */
    editable: true;
  };

/**
 * `DatePicker`'s props: the button trigger's (default), or, with `editable`, the DateField
 * group's, so `ref` and the handlers are typed for the element they land on.
 */
export type DatePickerProps = DatePickerButtonProps | DatePickerEditableProps;

/**
 * A Select-styled button that opens a `Calendar` in a popover. Picking a day closes it and
 * returns focus to the trigger; Escape or an outside click closes it unchanged. Name it with a
 * `Field` label, `aria-labelledby` or `aria-label`; the value text follows the name. With
 * `editable`, a typed `DateField` plus a calendar icon button replaces the trigger.
 */
export function DatePicker({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  name,
  placeholder = "Pick a date",
  format = { dateStyle: "medium" },
  locale,
  min,
  max,
  defaultMonth,
  isDateDisabled,
  weekStartsOn,
  labels,
  editable = false,
  ...props
}: DatePickerProps) {
  const field = useFieldRootContext();
  const [value, setValue] = useControllableState(valueProp, defaultValue);
  const resolvedLocale = resolveLocale(locale);
  const formatter = new Intl.DateTimeFormat(resolvedLocale, { ...format, calendar: "gregory" });
  const iso = value ? toISODate(value) : "";

  if (editable) {
    const pick = (date: Date | null) => {
      setValue(date);
      onValueChange?.(date);
    };
    return (
      <EditableShell
        {...(props as EditableElementProps & PickerOwnProps)}
        {...dateShellProps}
        openLabel={labels?.openCalendar ?? "Choose date"}
        dialogLabel={labels?.dialog ?? "Choose date"}
        renderField={(fieldProps) => (
          <DateField
            {...fieldProps}
            value={value}
            onValueChange={pick}
            name={name}
            locale={locale}
            min={min}
            max={max}
            isDateDisabled={isDateDisabled}
            labels={labels}
          />
        )}
        renderCalendar={(close) => (
          <Calendar
            value={value}
            onValueChange={(date) => {
              pick(date);
              close();
            }}
            locale={locale}
            min={min}
            max={max}
            defaultMonth={value ?? defaultMonth}
            isDateDisabled={isDateDisabled}
            weekStartsOn={weekStartsOn}
            labels={labels}
          />
        )}
      />
    );
  }

  const rangeMessage = dateValidationMessage(
    value,
    { min, max, isDateDisabled },
    labels,
    resolvedLocale,
  );
  return (
    <PickerShell
      {...(props as PickerTriggerProps)}
      text={value ? formatter.format(value) : null}
      placeholder={placeholder}
      dialogLabel={labels?.dialog ?? "Choose date"}
      outOfRange={rangeMessage !== ""}
      formControl={{
        value,
        inputValue: iso,
        formValue: iso,
        name: name ?? field.name,
        registrationName: name,
        customValidity: rangeMessage,
      }}
      renderCalendar={(close) => (
        <Calendar
          value={value}
          onValueChange={(date) => {
            setValue(date);
            onValueChange?.(date);
            close();
          }}
          locale={locale}
          min={min}
          max={max}
          defaultMonth={value ?? defaultMonth}
          isDateDisabled={isDateDisabled}
          weekStartsOn={weekStartsOn}
          labels={labels}
        />
      )}
    />
  );
}

interface DateRangePickerOwnProps extends PickerOwnProps, PickerFields {
  /** The picked range, controlled. */
  value?: DateRange;
  /** The initially picked range. @default { start: null, end: null } */
  defaultValue?: DateRange;
  /**
   * Called only with a complete range (both ends set), when the end is picked. `editable`: also
   * with the pair whenever a typed half becomes a complete date or `null` (DateRangeField's
   * contract), so an end may be `null` there.
   */
  onValueChange?: (value: DateRange) => void;
  /** Submits the start as `YYYY-MM-DD` (empty when unset) through a hidden input. */
  startName?: string;
  /** Submits the end as `YYYY-MM-DD` (empty when unset) through a hidden input. */
  endName?: string;
  /** Months shown side by side in the popup. @default 2 */
  numberOfMonths?: 1 | 2;
  /** @default "Pick a date range" */
  placeholder?: string;
}

/** Native props of the default, button-trigger `DateRangePicker` (those of the `<button>`). */
export type DateRangePickerButtonProps = DateRangePickerOwnProps &
  Omit<PickerTriggerProps, keyof DateRangePickerOwnProps> & {
    /** @default false */
    editable?: false;
  };

/** Native props of the `editable` `DateRangePicker` (those of the DateRangeField's group `<div>`). */
export type DateRangePickerEditableProps = DateRangePickerOwnProps &
  Omit<EditableElementProps, keyof DateRangePickerOwnProps> & {
    /**
     * Replaces the button trigger with a typed `DateRangeField` and a calendar icon button that
     * opens the same two-month popup. A typed complete range updates the calendar; picking both
     * ends fills both halves, closes it and returns focus to the icon button. It joins a Field and
     * Form as the DateRangeField does (`startName` / `endName` go to it). `placeholder` and
     * `format` are unused, and `ref`, `className`, `id` and the other native props go to the
     * DateRangeField's group element. `readOnly` keeps the segments focusable and disables the
     * icon button.
     */
    editable: true;
  };

/**
 * `DateRangePicker`'s props: the button trigger's (default), or, with `editable`, the
 * DateRangeField group's, so `ref` and the handlers are typed for the element they land on.
 */
export type DateRangePickerProps = DateRangePickerButtonProps | DateRangePickerEditableProps;

interface RangePickerCalendarProps extends Omit<RangeCalendarProps, "value" | "onValueChange"> {
  open: boolean;
  /** The committed range. */
  value: DateRange;
  /** Called with a complete range. */
  onCommit: (value: DateRange) => void;
}

/**
 * The popup's RangeCalendar plus the pick in progress (only the start chosen), which is never
 * reported. The draft is dropped whenever the effective open state turns false — however the
 * popup closed (a request, or a parent setting `open={false}`) — and kept while a parent refuses
 * a close by keeping `open` true.
 */
function RangePickerCalendar({ open, value, onCommit, ...props }: RangePickerCalendarProps) {
  const [draft, setDraft] = useState<DateRange | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setDraft(null);
  }
  return (
    <RangeCalendar
      {...props}
      value={draft ?? value}
      onValueChange={(next) => {
        if (!next.start || !next.end) {
          setDraft(next);
          return;
        }
        setDraft(null);
        onCommit(next);
      }}
    />
  );
}

/**
 * A Select-styled button that opens a `RangeCalendar` (two months by default). The first pick
 * sets the start and keeps it open; the second sets the end, commits and closes. Escape or an
 * outside click with only the start chosen reverts to the previous range. The trigger shows the
 * range with `Intl.DateTimeFormat#formatRange` ("Sep 1 – 12, 2026"). A range may span disabled
 * days: only its two ends are checked. With `editable`, a typed `DateRangeField` plus a calendar
 * icon button replaces the trigger.
 */
export function DateRangePicker({
  value: valueProp,
  defaultValue = emptyRange,
  onValueChange,
  startName,
  endName,
  numberOfMonths = 2,
  placeholder = "Pick a date range",
  format = { dateStyle: "medium" },
  locale,
  min,
  max,
  defaultMonth,
  isDateDisabled,
  weekStartsOn,
  labels,
  editable = false,
  ...props
}: DateRangePickerProps) {
  const [value, setValue] = useControllableState(valueProp, defaultValue);
  const resolvedLocale = resolveLocale(locale);
  const formatter = new Intl.DateTimeFormat(resolvedLocale, { ...format, calendar: "gregory" });

  const calendarProps = {
    numberOfMonths,
    locale,
    min,
    max,
    defaultMonth: value.start ?? defaultMonth,
    isDateDisabled,
    weekStartsOn,
    labels,
  };

  if (editable) {
    const pick = (next: DateRange) => {
      setValue(next);
      onValueChange?.(next);
    };
    // A typed start alone stays the calendar's start, so one click picks the end (an earlier one
    // swaps). A reversed typed range (invalid in the field) is no selection there: the calendar
    // must not draw it as a valid-looking band.
    const reversed = !!value.start && !!value.end && compareDay(value.end, value.start) < 0;
    const calendarValue = reversed ? emptyRange : value;
    return (
      <EditableShell
        {...(props as EditableElementProps & PickerOwnProps)}
        {...dateShellProps}
        growToContent
        openLabel={labels?.openCalendar ?? "Choose date range"}
        dialogLabel={labels?.dialog ?? "Choose date range"}
        renderField={(fieldProps) => (
          <DateRangeField
            {...fieldProps}
            value={value}
            onValueChange={pick}
            startName={startName}
            endName={endName}
            locale={locale}
            min={min}
            max={max}
            isDateDisabled={isDateDisabled}
            labels={labels}
          />
        )}
        renderCalendar={(close, open) => (
          <RangePickerCalendar
            {...calendarProps}
            open={open}
            value={calendarValue}
            onCommit={(next) => {
              pick(next);
              close();
            }}
          />
        )}
      />
    );
  }

  const { start, end } = value;
  const text =
    start && end ? formatter.formatRange(start, end) : start ? formatter.format(start) : null;
  const startISO = start ? toISODate(start) : "";
  const endISO = end ? toISODate(end) : "";
  const bounds = { min, max, isDateDisabled };
  // Only the ends are checked (a range may span disabled days); a lone start is incomplete (shown
  // at validation time only, as DateField's partial input).
  const rangeMessage =
    dateValidationMessage(start, bounds, labels, resolvedLocale) ||
    dateValidationMessage(end, bounds, labels, resolvedLocale);
  const customValidity =
    (start && !end) || (!start && end)
      ? (labels?.incomplete ?? "Choose both a start and an end date.")
      : rangeMessage;

  return (
    <PickerShell
      {...(props as PickerTriggerProps)}
      text={text}
      placeholder={placeholder}
      dialogLabel={labels?.dialog ?? "Choose date range"}
      outOfRange={rangeMessage !== ""}
      // One Field control (a Field registers one): the validating input holds the ISO interval
      // ("start/end", empty until both are set, so `required` needs both), `onFormSubmit` gets
      // `{ start, end }` under the Field's name, and the named inputs keep native FormData.
      formControl={{
        value,
        inputValue: start && end ? `${startISO}/${endISO}` : "",
        formValue: { start: startISO, end: endISO },
        customValidity,
      }}
      hiddenInputs={
        <>
          {startName && <input type="hidden" name={startName} value={startISO} />}
          {endName && <input type="hidden" name={endName} value={endISO} />}
        </>
      }
      renderCalendar={(close, open) => (
        <RangePickerCalendar
          {...calendarProps}
          open={open}
          value={value}
          onCommit={(next) => {
            setValue(next);
            onValueChange?.(next);
            close();
          }}
        />
      )}
    />
  );
}
