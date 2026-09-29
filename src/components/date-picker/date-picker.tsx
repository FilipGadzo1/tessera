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
import {
  type ComponentProps,
  type FocusEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { resolveLocale, toISODate, type WeekDay } from "../../lib/date";
import { CalendarIcon } from "../../lib/icons";
import { useControllableState } from "../../lib/use-controllable-state";
import {
  Calendar,
  type DateRange,
  emptyRange,
  RangeCalendar,
  type RangeCalendarProps,
} from "../calendar";
import type { CalendarLabels } from "../calendar/calendar-base";
import { Popover, PopoverContent, type PopoverContentProps, PopoverTrigger } from "../popover";
import { type SelectTriggerVariantProps, selectDefaults, selectTriggerVariants } from "../select";
import {
  type DateFormControlOptions,
  type DateValidationLabels,
  dateValidationMessage,
  focusLeaves,
  useDateFormControl,
} from "./date-form-control";

/**
 * Translatable strings: the popup's name, the calendar's month buttons and the validation
 * messages (a value outside `min` / `max`, or a day `isDateDisabled` rejects).
 */
export interface DatePickerLabels extends CalendarLabels, DateValidationLabels {
  /** The popup dialog's accessible name. @default "Choose date" ("Choose date range" for DateRangePicker) */
  dialog?: string;
  /**
   * DateRangePicker: the validation message while only the start is set.
   * @default "Choose both a start and an end date."
   */
  incomplete?: string;
}

/** Trigger and popup props shared by `DatePicker` and `DateRangePicker`. */
interface PickerTriggerProps
  extends Omit<
    ComponentProps<"button">,
    "value" | "defaultValue" | "onChange" | "children" | "type" | "name" | "disabled"
  > {
  /** Disables the trigger (a disabled `Field` does too). */
  disabled?: boolean;
  /** Requires a value to submit (DateRangePicker: both dates). */
  required?: boolean;
  /** Trigger height, padding and text size, as Select and Input. @default "md" */
  size?: SelectTriggerVariantProps["size"];
  /** Whether the calendar is open, controlled. */
  open?: boolean;
  /** Whether the calendar is initially open. @default false */
  defaultOpen?: boolean;
  /** Called when the calendar opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Element to portal the popup into (default `document.body`), e.g. inside a nested theme scope. */
  container?: PopoverContentProps["container"];
}

/** Calendar and formatting props shared by `DatePicker` and `DateRangePicker`. */
interface PickerSharedProps extends PickerTriggerProps {
  /** Trigger text while nothing is picked. */
  placeholder?: string;
  /** How the trigger shows the value. @default { dateStyle: "medium" } */
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

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
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
  const setTriggerRef = useCallback(
    (element: HTMLButtonElement | null) => {
      triggerRef.current = element;
      assignRef(ref, element);
    },
    [ref],
  );

  const [open, setControllableOpen] = useControllableState(openProp, defaultOpen, onOpenChange);
  // Dedupe locally: the hook itself always calls onChange, but a Popover can re-request the
  // state it's already in (e.g. its own onOpenChange wrapper), and that must not re-fire
  // onOpenChange for callers relying on it only firing on an actual change.
  const setOpen = (next: boolean) => {
    if (next === open) return;
    setControllableOpen(next);
  };

  const isDisabled = !!disabled || field.state.disabled;
  const invalid = field.state.valid === false;
  const formControl = useDateFormControl({
    ...formControlOptions,
    required,
    disabled: isDisabled,
    controlRef: triggerRef,
  });
  // The Field's focus leaves the picker when it leaves both the trigger and the popup.
  const onBlurOut = (event: FocusEvent) => {
    if (focusLeaves(event, triggerRef.current, popupRef.current)) formControl.onBlur();
  };

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
        onFocus={(event) => {
          props.onFocus?.(event);
          formControl.onFocus();
        }}
        onBlur={(event) => {
          props.onBlur?.(event);
          onBlurOut(event);
        }}
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
        onBlur={onBlurOut}
        container={container}
        align="start"
        sideOffset={6}
        aria-label={dialogLabel}
        data-slot="date-picker-content"
        className={contentBase}
        // Focus the calendar's Tab stop (the selected day, else today), not the Previous button.
        initialFocus={() =>
          popupRef.current?.querySelector<HTMLElement>(
            '[data-slot="calendar-day"][tabindex="0"]',
          ) ?? true
        }
      >
        {renderCalendar(() => setOpen(false), open)}
      </PopoverContent>
    </Popover>
  );
}

export interface DatePickerProps extends PickerSharedProps {
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

/**
 * A Select-styled button that opens a `Calendar` in a popover. Picking a day closes it and
 * returns focus to the trigger; Escape or an outside click closes it unchanged. Name it with a
 * `Field` label, `aria-labelledby` or `aria-label`; the value text follows the name.
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
  ...props
}: DatePickerProps) {
  const field = useFieldRootContext();
  const [value, setValue] = useControllableState(valueProp, defaultValue);
  const resolvedLocale = resolveLocale(locale);
  const formatter = new Intl.DateTimeFormat(resolvedLocale, format);
  const iso = value ? toISODate(value) : "";

  return (
    <PickerShell
      {...props}
      text={value ? formatter.format(value) : null}
      placeholder={placeholder}
      dialogLabel={labels?.dialog ?? "Choose date"}
      formControl={{
        value,
        inputValue: iso,
        formValue: iso,
        name: name ?? field.name,
        registrationName: name,
        customValidity: dateValidationMessage(
          value,
          { min, max, isDateDisabled },
          labels,
          resolvedLocale,
        ),
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

export interface DateRangePickerProps extends PickerSharedProps {
  /** The picked range, controlled. */
  value?: DateRange;
  /** The initially picked range. @default { start: null, end: null } */
  defaultValue?: DateRange;
  /** Called only with a complete range (both ends set), when the end is picked. */
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
 * days: only its two ends are checked.
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
  ...props
}: DateRangePickerProps) {
  const [value, setValue] = useControllableState(valueProp, defaultValue);
  const resolvedLocale = resolveLocale(locale);
  const formatter = new Intl.DateTimeFormat(resolvedLocale, format);

  const { start, end } = value;
  const text =
    start && end ? formatter.formatRange(start, end) : start ? formatter.format(start) : null;
  const startISO = start ? toISODate(start) : "";
  const endISO = end ? toISODate(end) : "";
  const bounds = { min, max, isDateDisabled };
  // Only the ends are checked (a range may span disabled days); a lone start is incomplete.
  const customValidity =
    (start && !end) || (!start && end)
      ? (labels?.incomplete ?? "Choose both a start and an end date.")
      : dateValidationMessage(start, bounds, labels, resolvedLocale) ||
        dateValidationMessage(end, bounds, labels, resolvedLocale);

  return (
    <PickerShell
      {...props}
      text={text}
      placeholder={placeholder}
      dialogLabel={labels?.dialog ?? "Choose date range"}
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
          open={open}
          value={value}
          onCommit={(next) => {
            setValue(next);
            onValueChange?.(next);
            close();
          }}
          numberOfMonths={numberOfMonths}
          locale={locale}
          min={min}
          max={max}
          defaultMonth={start ?? defaultMonth}
          isDateDisabled={isDateDisabled}
          weekStartsOn={weekStartsOn}
          labels={labels}
        />
      )}
    />
  );
}
