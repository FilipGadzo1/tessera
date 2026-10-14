"use client";

import {
  type ComponentProps,
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
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
  resolveLocale,
  startOfMonth,
  startOfWeek,
  toDay,
  toISODate,
  type WeekDay,
} from "../../lib/date";
import { isRtl } from "../../lib/direction";
import { claimEscape } from "../../lib/tooltip-escape";
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
import {
  CalendarCaptionButtons,
  CalendarNavButton,
  type CalendarView,
  type CalendarViewFormatters,
  CalendarViewGrid,
  CalendarViewHeader,
  type CalendarViewLabels,
  clampOrdinal,
  monthFromOrdinal,
  monthOrdinal,
  ordinalBounds,
  PAGE_SIZE,
  viewCaption,
} from "./calendar-views";

/** Translatable strings for the calendar's controls. */
export interface CalendarLabels extends CalendarViewLabels {
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
  /**
   * BCP 47 locale for names, labels and the week start.
   * @default the document's `lang`, else the browser's
   *
   * When server-rendering, the default resolves `document.documentElement.lang` on the client
   * only (there is no DOM on the server), and "today" is also computed at render time — both can
   * disagree between the server and the client and cause a hydration mismatch. Pass `locale`
   * explicitly when server-rendering; an inline Calendar's today marker is computed on the client
   * (see the backlog: a real fix would add a `today` prop, or move the "today" computation into
   * an effect).
   */
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

interface CalendarFormatters extends CalendarViewFormatters {
  full: Intl.DateTimeFormat;
  dayNumber: Intl.DateTimeFormat;
  weekdays: { key: number; long: string; short: string }[];
}

function useFormatters(locale: string | undefined, weekStartsOn: WeekDay): CalendarFormatters {
  return useMemo(() => {
    // Gregorian only (Phase L ruling): the grid is Gregorian, so a locale whose default calendar
    // differs (fa-IR, th-TH, ar-SA) or a `-u-ca-` tag must not rename the month, year or day.
    const gregorian = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, { ...options, calendar: "gregory" });
    const caption = gregorian({ month: "long", year: "numeric" });
    const full = gregorian({ dateStyle: "full" });
    const dayNumber = gregorian({ day: "numeric" });
    const longWeekday = gregorian({ weekday: "long" });
    const shortWeekday = gregorian({ weekday: "short" });
    const narrowWeekday = gregorian({ weekday: "narrow" });
    // Any week works for the names: take the one starting on 2026-01-04 (a Sunday).
    const week = Array.from(
      { length: 7 },
      (_, i) => new Date(2026, 0, 4 + ((weekStartsOn + i) % 7)),
    );
    const shorts = week.map((date) => shortWeekday.format(date));
    // A short name longer than 3 code units won't fit the size-9 column: whole words (ar-EG) or
    // dotted/longer abbreviations (fr-FR "lun.", pl-PL "niedz."). Then the whole row goes narrow.
    const useNarrow = shorts.some((name) => name.length > 3);
    const weekdays = week.map((date, i) => ({
      key: date.getDay(),
      long: longWeekday.format(date),
      short: useNarrow ? narrowWeekday.format(date) : (shorts[i] as string),
    }));
    // The caption buttons follow the locale's order: month first ("September 2026") or year
    // first (ja-JP "2026年9月", hu-HU "2026. szeptember").
    const parts = caption.formatToParts(new Date(2026, 8, 1)).map((part) => part.type);
    const yearFirst = parts.indexOf("year") < parts.indexOf("month");
    const monthName = gregorian({ month: "long" });
    const shortMonth = gregorian({ month: "short" });
    const year = gregorian({ year: "numeric" });
    return {
      caption,
      full,
      dayNumber,
      weekdays,
      yearFirst,
      monthName,
      shortMonth,
      yearOf: (y: number) => year.format(new Date(y, 0, 1)),
      yearRange: (from: number) =>
        year.formatRange(new Date(from, 0, 1), new Date(from + PAGE_SIZE - 1, 0, 1)),
    };
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
  onKeyDown,
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
  // Month and year views (spec §6.2): one pane at a time shows one; see calendar-views.tsx.
  const [view, setView] = useState<CalendarView>({ kind: "day" });
  const firstEnabledDay = () => {
    for (let day = firstMonth; isSameMonth(day, firstMonth); day = addDays(day, 1)) {
      if (!isDisabled(day)) return day;
    }
    return firstMonth;
  };
  const tabStop =
    [focusedDay, selectedDay, today].find((day) => day && isVisible(day)) ?? firstEnabledDay();

  const dayId = (date: Date) => `${id}-day-${toISODate(date)}`;
  const viewItemId = (kind: string, ordinal: number) => `${id}-${kind}-${ordinal}`;
  /** The id of the element to focus after the next render (a day, or a month/year cell). */
  const pendingFocus = useRef<string | null>(null);
  const focusPending = () => {
    const target = pendingFocus.current;
    if (!target) return;
    // One attempt only: the month change and the focus move render together, so a day that isn't
    // there now (a controlled `month` that ignored `onMonthChange`) must not steal focus later.
    pendingFocus.current = null;
    const element = document.getElementById(target);
    if (element) {
      element.focus();
      return;
    }
    // The target isn't rendered (a controlled `month` ignored `onMonthChange`). If focus was lost
    // with it (a chosen month cell unmounted), fall back to this calendar's Tab stop, never <body>.
    if (document.activeElement && document.activeElement !== document.body) return;
    document
      .getElementById(`${id}-caption-0`)
      ?.closest('[data-slot="calendar"]')
      ?.querySelector<HTMLElement>('[data-slot="calendar-day"][tabindex="0"]')
      ?.focus();
  };
  // After every render, before paint: focus the day a keyboard move asked for (it may be in a new
  // month). A layout effect, not a passive one: when the month changes the focused button unmounts,
  // and focus must not sit on <body> until after paint (a Popover would read that as focus leaving).
  useLayoutEffect(focusPending);

  // biome-ignore lint/correctness/useExhaustiveDependencies: focus once, on mount.
  useEffect(() => {
    if (!autoFocus) return;
    pendingFocus.current = dayId(tabStop);
    focusPending();
  }, []);

  const moveFocus = (date: Date) => {
    setFocusedDay(date);
    pendingFocus.current = dayId(date);
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

  /** Day-grid interaction closes an open month/year view (in the other pane, with two months). */
  const closeViewForDays = () => {
    if (view.kind !== "day") setView({ kind: "day" });
  };

  const onDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    // Alt/Ctrl/Meta combinations belong to the browser and OS (Alt+ArrowLeft is Back). Shift stays:
    // Shift+PageUp/PageDown move by a year.
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const rtl = isRtl(event.currentTarget);
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
    closeViewForDays();
    moveFocus(clampDay(next, min, max));
  };

  const onDayClick = (date: Date) => {
    closeViewForDays();
    if (isDisabled(date)) return;
    onDaySelect(date);
    if (isVisible(date)) setFocusedDay(date);
    else moveFocus(date);
  };

  const boundsOf = (kind: "month" | "year") => ordinalBounds(kind, min, max);
  const openView = (kind: "month" | "year", pane: number, focus: number) => {
    const clamped = clampOrdinal(focus, boundsOf(kind));
    setView({ kind, pane, focus: clamped });
    // The clicked caption button may unmount: focus the view's Tab stop before paint.
    pendingFocus.current = viewItemId(kind, clamped);
  };
  const closeView = (focusDay: Date) => {
    setView({ kind: "day" });
    setFocusedDay(focusDay);
    pendingFocus.current = dayId(focusDay);
  };
  const chooseMonth = (pane: number, ordinal: number) => {
    const month = monthFromOrdinal(ordinal);
    // The pane shows the chosen month; with two months the pair shifts around it, but never so far
    // that the other pane lies entirely outside min/max.
    let first = addMonths(month, -pane);
    if (max) {
      const latest = addMonths(startOfMonth(max), -(numberOfMonths - 1));
      if (compareDay(first, latest) > 0) first = latest;
    }
    if (min && compareDay(first, startOfMonth(min)) < 0) first = startOfMonth(min);
    setMonth(first);
    // Focus the Tab stop's day number in the chosen month, clamped to its length and min/max.
    const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const day = new Date(
      month.getFullYear(),
      month.getMonth(),
      Math.min(tabStop.getDate(), length),
    );
    closeView(clampDay(day, min, max));
  };
  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.key !== "Escape" || view.kind === "day" || event.defaultPrevented) return;
    // Escape steps back to the days. It is claimed, not stopped (src/lib/tooltip-escape.ts): an
    // enclosing Tessera overlay (the picker's Popover, a Dialog) cancels its Escape close for this
    // event, and an app's own keydown listeners still receive it.
    event.preventDefault();
    claimEscape(event.nativeEvent);
    closeView(tabStop);
  };

  const prevDisabled = !!min && compareDay(firstMonth, startOfMonth(min)) <= 0;
  const nextDisabled = !!max && compareDay(lastMonth, startOfMonth(max)) >= 0;
  const spacer = <span aria-hidden="true" className="size-8 shrink-0" />;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: delegated Escape for the month/year views; the focusable parts inside handle their own keys.
    <div
      {...props}
      data-slot="calendar"
      className={cn(calendarRootClasses(numberOfMonths), className)}
      onKeyDown={onRootKeyDown}
    >
      {visibleMonths.map((month, index) => {
        const captionId = `${id}-caption-${index}`;
        const paneView = view.kind !== "day" && view.pane === index ? view : null;
        return (
          // Keyed by position, not month: the caption's live region must persist across month
          // changes for its new text to be announced.
          // biome-ignore lint/suspicious/noArrayIndexKey: positional on purpose (see above).
          <div key={index} data-slot="calendar-month" className={calendarMonthClasses}>
            <div data-slot="calendar-header" className={calendarHeaderClasses}>
              {/* First, so it keeps its place (and its announcements) whatever the header shows. */}
              <div
                id={captionId}
                data-slot="calendar-caption"
                aria-live="polite"
                className={calendarCaptionClasses}
              >
                {paneView ? viewCaption(paneView, formatters) : formatters.caption.format(month)}
              </div>
              {paneView ? (
                <CalendarViewHeader
                  view={paneView}
                  bounds={boundsOf(paneView.kind)}
                  labels={labels}
                  formatters={formatters}
                  onFocusChange={(focus) => setView({ ...paneView, focus })}
                  onOpenYears={(year) => openView("year", index, year)}
                  caption={formatters.caption.format(month)}
                  onShowDays={() => closeView(tabStop)}
                />
              ) : (
                <>
                  {index === 0 ? (
                    <CalendarNavButton
                      direction="prev"
                      label={labels?.previousMonth ?? "Previous month"}
                      disabled={prevDisabled}
                      onPage={() => {
                        closeViewForDays();
                        setMonth(addMonths(firstMonth, -1));
                      }}
                    />
                  ) : (
                    spacer
                  )}
                  <CalendarCaptionButtons
                    month={month}
                    labels={labels}
                    formatters={formatters}
                    onOpen={(kind) =>
                      openView(
                        kind,
                        index,
                        kind === "month" ? monthOrdinal(month) : month.getFullYear(),
                      )
                    }
                  />
                  {index === numberOfMonths - 1 ? (
                    <CalendarNavButton
                      direction="next"
                      label={labels?.nextMonth ?? "Next month"}
                      disabled={nextDisabled}
                      onPage={() => {
                        closeViewForDays();
                        setMonth(addMonths(firstMonth, 1));
                      }}
                    />
                  ) : (
                    spacer
                  )}
                </>
              )}
            </div>
            {paneView ? (
              <CalendarViewGrid
                view={paneView}
                month={month}
                today={today}
                bounds={boundsOf(paneView.kind)}
                labels={labels}
                formatters={formatters}
                itemId={(ordinal) => viewItemId(paneView.kind, ordinal)}
                onFocusMove={(focus) => {
                  setView({ ...paneView, focus });
                  pendingFocus.current = viewItemId(paneView.kind, focus);
                }}
                onChoose={(ordinal) =>
                  paneView.kind === "month"
                    ? chooseMonth(index, ordinal)
                    : openView("month", index, ordinal * 12 + month.getMonth())
                }
              />
            ) : (
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
            )}
          </div>
        );
      })}
    </div>
  );
}
