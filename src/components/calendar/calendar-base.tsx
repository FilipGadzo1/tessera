"use client";

import {
  type ComponentProps,
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import {
  addDays,
  addMonths,
  addYears,
  clampDay,
  compareDay,
  endOfWeek,
  getMonthGrid,
  getWeekStartsOn,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  toDay,
  toISODate,
  type WeekDay,
} from "../../lib/date";
import { ChevronLeftIcon, ChevronRightIcon } from "../../lib/icons";
import { buttonVariants } from "../button/button-variants";
import {
  type CalendarDayState,
  calendarCaptionClasses,
  calendarCellClasses,
  calendarDayClasses,
  calendarGridClasses,
  calendarHeaderClasses,
  calendarMonthClasses,
  calendarRootClasses,
  calendarWeekdayClasses,
} from "./calendar-variants";

/** Translatable strings for the calendar's controls. */
export interface CalendarLabels {
  /** @default "Previous month" */
  previousMonth?: string;
  /** @default "Next month" */
  nextMonth?: string;
}

/** Props shared by `Calendar` and `RangeCalendar`. */
export interface CalendarSharedProps
  extends Omit<ComponentProps<"div">, "defaultValue" | "onChange" | "autoFocus" | "children"> {
  /** The visible (first) month, controlled. Any day in the month works. */
  month?: Date;
  /** The initially visible month. @default the value's month, else today's */
  defaultMonth?: Date;
  /** Called with the 1st of the new visible (first) month. */
  onMonthChange?: (month: Date) => void;
  /** The earliest selectable day; earlier days are disabled and keyboard moves stop here. */
  min?: Date | null;
  /** The latest selectable day; later days are disabled and keyboard moves stop here. */
  max?: Date | null;
  /** Disables individual days (they stay focusable, as the APG date grid recommends). */
  isDateDisabled?: (date: Date) => boolean;
  /** BCP 47 locale for names, labels and the week start. @default the document's `lang`, else the browser's */
  locale?: string;
  /** First day of the week, 0 = Sunday … 6 = Saturday. @default the locale's */
  weekStartsOn?: WeekDay;
  /** Show (and allow selecting) the adjacent months' days that fill the first and last weeks. @default true */
  showOutsideDays?: boolean;
  /** Focus the selected day (else today, else the first enabled day) on mount. */
  autoFocus?: boolean;
  /** Translated control labels. */
  labels?: CalendarLabels;
}

/** Selection-derived part of a day's state, supplied by `Calendar` / `RangeCalendar`. */
export type CalendarSelectionState = Pick<
  CalendarDayState,
  | "selected"
  | "rangeStart"
  | "rangeEnd"
  | "rangeMiddle"
  | "rangePreview"
  | "bandAfter"
  | "bandBefore"
> & {
  /** Sets `aria-selected="true"` on the day's gridcell. */
  ariaSelected: boolean;
};

export interface CalendarBaseProps extends CalendarSharedProps {
  numberOfMonths: number;
  /** The day the Tab stop prefers after the focused day (the value, or a range's start). */
  selectedDay: Date | null;
  getSelectionState: (date: Date) => CalendarSelectionState;
  onDaySelect: (date: Date) => void;
  /** The hovered or focused day (`null` when the pointer leaves), for range previews. */
  onPreviewDay?: (date: Date | null) => void;
}

function resolveLocale(locale: string | undefined): string | undefined {
  const candidate =
    locale ?? (typeof document === "undefined" ? undefined : document.documentElement.lang);
  if (!candidate) return undefined;
  try {
    return Intl.getCanonicalLocales(candidate)[0];
  } catch {
    return undefined;
  }
}

function useFormatters(locale: string | undefined, weekStartsOn: WeekDay) {
  return useMemo(() => {
    const caption = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
    const full = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
    const dayNumber = new Intl.DateTimeFormat(locale, { day: "numeric" });
    const longWeekday = new Intl.DateTimeFormat(locale, { weekday: "long" });
    const shortWeekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const narrowWeekday = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
    // Any week works for the names: take the one starting on 2026-01-04 (a Sunday).
    const week = Array.from(
      { length: 7 },
      (_, i) => new Date(2026, 0, 4 + ((weekStartsOn + i) % 7)),
    );
    const shorts = week.map((date) => shortWeekday.format(date));
    // Some locales' "short" names are whole words (ar-EG): fall back to "narrow" to fit the column.
    const useNarrow = shorts.some((name) => name.length > 3);
    const weekdays = week.map((date, i) => ({
      key: date.getDay(),
      long: longWeekday.format(date),
      short: useNarrow ? narrowWeekday.format(date) : (shorts[i] as string),
    }));
    return { caption, full, dayNumber, weekdays };
  }, [locale, weekStartsOn]);
}

/**
 * The shared grid behind `Calendar` and `RangeCalendar` (internal): header with prev/next and a
 * live caption per month, a `role="grid"` table per month, roving tabindex and the APG date grid
 * keyboard model. Selection itself is supplied by the wrapper through `getSelectionState` /
 * `onDaySelect`.
 */
export function CalendarBase({
  numberOfMonths,
  selectedDay,
  getSelectionState,
  onDaySelect,
  onPreviewDay,
  month: monthProp,
  defaultMonth,
  onMonthChange,
  min,
  max,
  isDateDisabled,
  locale: localeProp,
  weekStartsOn: weekStartsOnProp,
  showOutsideDays = true,
  autoFocus = false,
  labels,
  className,
  ...props
}: CalendarBaseProps) {
  const id = useId();
  const locale = resolveLocale(localeProp);
  const weekStartsOn = weekStartsOnProp ?? getWeekStartsOn(locale);
  const formatters = useFormatters(locale, weekStartsOn);
  const today = toDay(new Date());

  const [internalMonth, setInternalMonth] = useState(() =>
    startOfMonth(defaultMonth ?? selectedDay ?? today),
  );
  const firstMonth = monthProp ? startOfMonth(monthProp) : internalMonth;
  const visibleMonths = Array.from({ length: numberOfMonths }, (_, i) => addMonths(firstMonth, i));
  const lastMonth = visibleMonths[visibleMonths.length - 1] as Date;
  const isVisible = (date: Date) => visibleMonths.some((month) => isSameMonth(month, date));

  const setMonth = (next: Date) => {
    const month = startOfMonth(next);
    if (isSameMonth(month, firstMonth)) return;
    if (monthProp === undefined) setInternalMonth(month);
    onMonthChange?.(month);
  };

  const isDisabled = (date: Date) =>
    (!!min && compareDay(date, min) < 0) ||
    (!!max && compareDay(date, max) > 0) ||
    (isDateDisabled?.(date) ?? false);

  // Roving tabindex: the focused day, else the selected day, else today (when visible), else the
  // first enabled day of the first visible month.
  const [focusedDay, setFocusedDay] = useState<Date | null>(null);
  const firstEnabledDay = () => {
    for (let day = firstMonth; isSameMonth(day, firstMonth); day = addDays(day, 1)) {
      if (!isDisabled(day)) return day;
    }
    return firstMonth;
  };
  const tabStop =
    [focusedDay, selectedDay, today].find((day) => day && isVisible(day)) ?? firstEnabledDay();

  const dayId = (date: Date) => `${id}-day-${toISODate(date)}`;
  const pendingFocus = useRef<Date | null>(null);
  const focusPending = () => {
    const date = pendingFocus.current;
    if (!date) return;
    // One attempt only: the month change and the focus move render together, so a day that isn't
    // there now (a controlled `month` that ignored `onMonthChange`) must not steal focus later.
    pendingFocus.current = null;
    document.getElementById(dayId(date))?.focus();
  };
  // After every render: focus the day a keyboard move asked for (it may be in a new month).
  useEffect(focusPending);

  // biome-ignore lint/correctness/useExhaustiveDependencies: focus once, on mount.
  useEffect(() => {
    if (!autoFocus) return;
    pendingFocus.current = tabStop;
    focusPending();
  }, []);

  const moveFocus = (date: Date) => {
    setFocusedDay(date);
    pendingFocus.current = date;
    if (!isVisible(date)) {
      // Keep the day in view: it becomes the first visible month when going back, the last one
      // when going forward, so two-month navigation is continuous.
      setMonth(
        compareDay(date, firstMonth) < 0
          ? date
          : addMonths(startOfMonth(date), -(numberOfMonths - 1)),
      );
    }
  };

  const onDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    let next: Date;
    switch (event.key) {
      case "ArrowLeft":
        next = addDays(date, rtl ? 1 : -1);
        break;
      case "ArrowRight":
        next = addDays(date, rtl ? -1 : 1);
        break;
      case "ArrowUp":
        next = addDays(date, -7);
        break;
      case "ArrowDown":
        next = addDays(date, 7);
        break;
      case "Home":
        next = startOfWeek(date, weekStartsOn);
        break;
      case "End":
        next = endOfWeek(date, weekStartsOn);
        break;
      case "PageUp":
        next = event.shiftKey ? addYears(date, -1) : addMonths(date, -1);
        break;
      case "PageDown":
        next = event.shiftKey ? addYears(date, 1) : addMonths(date, 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    moveFocus(clampDay(next, min, max));
  };

  const onDayClick = (date: Date) => {
    if (isDisabled(date)) return;
    onDaySelect(date);
    if (isVisible(date)) setFocusedDay(date);
    else moveFocus(date);
  };

  const prevDisabled = !!min && compareDay(firstMonth, startOfMonth(min)) <= 0;
  const nextDisabled = !!max && compareDay(lastMonth, startOfMonth(max)) >= 0;
  const navClasses = buttonVariants({ variant: "ghost", color: "neutral", size: "icon-sm" });
  const spacer = <span aria-hidden="true" className="size-8 shrink-0" />;

  return (
    <div
      {...props}
      data-slot="calendar"
      className={cn(calendarRootClasses(numberOfMonths), className)}
    >
      {visibleMonths.map((month, index) => {
        const captionId = `${id}-caption-${index}`;
        return (
          // Keyed by position, not month: the caption's live region must persist across month
          // changes for its new text to be announced.
          // biome-ignore lint/suspicious/noArrayIndexKey: positional on purpose (see above).
          <div key={index} data-slot="calendar-month" className={calendarMonthClasses}>
            <div data-slot="calendar-header" className={calendarHeaderClasses}>
              {index === 0 ? (
                <button
                  type="button"
                  data-slot="calendar-prev"
                  aria-label={labels?.previousMonth ?? "Previous month"}
                  aria-disabled={prevDisabled || undefined}
                  data-disabled={prevDisabled ? "" : undefined}
                  className={navClasses}
                  onClick={() => {
                    if (!prevDisabled) setMonth(addMonths(firstMonth, -1));
                  }}
                >
                  <ChevronLeftIcon className="rtl:-scale-x-100" />
                </button>
              ) : (
                spacer
              )}
              <div
                id={captionId}
                data-slot="calendar-caption"
                aria-live="polite"
                className={calendarCaptionClasses}
              >
                {formatters.caption.format(month)}
              </div>
              {index === numberOfMonths - 1 ? (
                <button
                  type="button"
                  data-slot="calendar-next"
                  aria-label={labels?.nextMonth ?? "Next month"}
                  aria-disabled={nextDisabled || undefined}
                  data-disabled={nextDisabled ? "" : undefined}
                  className={navClasses}
                  onClick={() => {
                    if (!nextDisabled) setMonth(addMonths(firstMonth, 1));
                  }}
                >
                  <ChevronRightIcon className="rtl:-scale-x-100" />
                </button>
              ) : (
                spacer
              )}
            </div>
            <table
              // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the APG date grid is a table with grid roles.
              role="grid"
              aria-labelledby={captionId}
              data-slot="calendar-grid"
              className={calendarGridClasses}
              onPointerLeave={() => onPreviewDay?.(null)}
            >
              <thead>
                <tr>
                  {formatters.weekdays.map((weekday) => (
                    <th
                      key={weekday.key}
                      scope="col"
                      abbr={weekday.long}
                      data-slot="calendar-weekday"
                      className={calendarWeekdayClasses}
                    >
                      {weekday.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getMonthGrid(month, weekStartsOn).map((week) => (
                  <tr key={toISODate(week[0] as Date)}>
                    {week.map((date) => {
                      const iso = toISODate(date);
                      const outside = !isSameMonth(date, month);
                      // With two months, the days between them aren't repeated as outside days.
                      if (outside && (!showOutsideDays || isVisible(date))) {
                        return (
                          // biome-ignore lint/a11y/useFocusableInteractive: focus lives on the day button inside (APG date grid).
                          <td
                            key={iso}
                            // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the APG date grid is a table with grid roles.
                            role="gridcell"
                            data-slot="calendar-cell"
                            className={calendarCellClasses}
                          />
                        );
                      }
                      const selection = getSelectionState(date);
                      const disabled = isDisabled(date);
                      const isToday = isSameDay(date, today);
                      return (
                        // biome-ignore lint/a11y/useFocusableInteractive: focus lives on the day button inside (APG date grid).
                        <td
                          key={iso}
                          // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the APG date grid is a table with grid roles.
                          role="gridcell"
                          aria-selected={selection.ariaSelected || undefined}
                          data-slot="calendar-cell"
                          className={calendarCellClasses}
                        >
                          <button
                            type="button"
                            id={outside ? undefined : dayId(date)}
                            tabIndex={!outside && isSameDay(date, tabStop) ? 0 : -1}
                            aria-label={formatters.full.format(date)}
                            aria-current={isToday ? "date" : undefined}
                            aria-disabled={disabled || undefined}
                            data-slot="calendar-day"
                            data-date={iso}
                            data-today={isToday ? "" : undefined}
                            data-outside={outside ? "" : undefined}
                            data-disabled={disabled ? "" : undefined}
                            data-selected={selection.selected ? "" : undefined}
                            data-range-start={selection.rangeStart ? "" : undefined}
                            data-range-end={selection.rangeEnd ? "" : undefined}
                            data-range-middle={selection.rangeMiddle ? "" : undefined}
                            data-range-preview={selection.rangePreview ? "" : undefined}
                            className={calendarDayClasses({
                              ...selection,
                              today: isToday,
                              outside,
                              disabled,
                            })}
                            onClick={() => onDayClick(date)}
                            onKeyDown={(event) => onDayKeyDown(event, date)}
                            onFocus={() => {
                              setFocusedDay(date);
                              onPreviewDay?.(date);
                            }}
                            onPointerEnter={() => onPreviewDay?.(date)}
                          >
                            {formatters.dayNumber.format(date)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
