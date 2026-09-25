"use client";

import { useState } from "react";
import { compareDay, isBetweenDays, isSameDay } from "../../lib/date";
import {
  CalendarBase,
  type CalendarSelectionState,
  type CalendarSharedProps,
} from "./calendar-base";

export interface CalendarProps extends CalendarSharedProps {
  /** The selected day, controlled. */
  value?: Date | null;
  /** The initially selected day. @default null */
  defaultValue?: Date | null;
  /** Called with the day the user selects (local midnight). */
  onValueChange?: (value: Date) => void;
}

/**
 * A month grid for picking one day (hand-built on the WAI-ARIA APG date picker grid — Base UI has
 * no calendar primitive). Arrows, Home/End, PageUp/PageDown (+Shift for years) move a single
 * roving Tab stop; Enter/Space or a click select. Names, the week start and labels come from
 * `Intl` for `locale`.
 */
export function Calendar({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  ...props
}: CalendarProps) {
  const [internalValue, setInternalValue] = useState<Date | null>(defaultValue);
  const value = valueProp !== undefined ? valueProp : internalValue;

  const getSelectionState = (date: Date): CalendarSelectionState => {
    const selected = isSameDay(date, value);
    return {
      selected,
      rangeStart: false,
      rangeEnd: false,
      rangeMiddle: false,
      rangePreview: false,
      bandAfter: false,
      bandBefore: false,
      ariaSelected: selected,
    };
  };

  return (
    <CalendarBase
      {...props}
      numberOfMonths={1}
      selectedDay={value}
      getSelectionState={getSelectionState}
      onDaySelect={(date) => {
        if (valueProp === undefined) setInternalValue(date);
        onValueChange?.(date);
      }}
    />
  );
}

/** A date range; either end may be unset while the user is choosing. */
export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface RangeCalendarProps extends CalendarSharedProps {
  /** The selected range, controlled. */
  value?: DateRange;
  /** The initially selected range. @default { start: null, end: null } */
  defaultValue?: DateRange;
  /**
   * Called on every selection step: `{ start, end: null }` after the first day, then the complete
   * `{ start, end }` (ordered) after the second.
   */
  onValueChange?: (value: DateRange) => void;
  /** Months shown side by side; keyboard navigation runs continuously across them. @default 1 */
  numberOfMonths?: 1 | 2;
}

const emptyRange: DateRange = { start: null, end: null };

/**
 * A calendar for picking a range: the first activation sets the start, the second the end (an
 * earlier second day swaps them), a third starts over. While only the start is set, the hovered
 * or focused day previews the range (`data-range-preview`).
 */
export function RangeCalendar({
  value: valueProp,
  defaultValue = emptyRange,
  onValueChange,
  numberOfMonths = 1,
  ...props
}: RangeCalendarProps) {
  const [internalValue, setInternalValue] = useState<DateRange>(defaultValue);
  const value = valueProp ?? internalValue;
  const [previewDay, setPreviewDay] = useState<Date | null>(null);

  const { start, end } = value;
  // The band's ends: the committed range, or the start and the previewed day, in order.
  const other = end ?? (start && previewDay && !isSameDay(start, previewDay) ? previewDay : null);
  const [low, high] =
    start && other
      ? compareDay(start, other) <= 0
        ? [start, other]
        : [other, start]
      : [null, null];
  const previewing = !end && !!other;

  const getSelectionState = (date: Date): CalendarSelectionState => {
    const isStart = isSameDay(date, start);
    if (!low || !high) {
      return {
        selected: isStart,
        rangeStart: isStart,
        rangeEnd: false,
        rangeMiddle: false,
        rangePreview: false,
        bandAfter: false,
        bandBefore: false,
        ariaSelected: isStart,
      };
    }
    const isLow = isSameDay(date, low);
    const isHigh = isSameDay(date, high);
    const inside = isBetweenDays(date, low, high);
    const between = inside && !isLow && !isHigh;
    if (previewing) {
      // Only the committed start is selected; the rest of the band (including the previewed
      // day) is a preview.
      return {
        selected: isStart,
        rangeStart: isStart,
        rangeEnd: false,
        rangeMiddle: false,
        rangePreview: inside && !isStart,
        bandAfter: isStart && isLow,
        bandBefore: isStart && isHigh,
        ariaSelected: isStart,
      };
    }
    const single = isSameDay(low, high);
    return {
      selected: isLow || isHigh,
      rangeStart: isLow,
      rangeEnd: isHigh,
      rangeMiddle: between,
      rangePreview: false,
      bandAfter: isLow && !single,
      bandBefore: isHigh && !single,
      ariaSelected: inside,
    };
  };

  const onDaySelect = (date: Date) => {
    let next: DateRange;
    if (!start || end) next = { start: date, end: null };
    else if (compareDay(date, start) < 0) next = { start: date, end: start };
    else next = { start, end: date };
    if (valueProp === undefined) setInternalValue(next);
    onValueChange?.(next);
  };

  return (
    <CalendarBase
      {...props}
      numberOfMonths={numberOfMonths}
      selectedDay={start}
      getSelectionState={getSelectionState}
      onDaySelect={onDaySelect}
      onPreviewDay={setPreviewDay}
    />
  );
}
