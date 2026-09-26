"use client";

import type { KeyboardEvent } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../../lib/icons";
import { buttonVariants } from "../button/button-variants";
import {
  calendarCaptionButtonClasses,
  calendarCaptionGroupClasses,
  calendarViewCellClasses,
  calendarViewGridClasses,
  calendarViewItemClasses,
  calendarYearRangeClasses,
} from "./calendar-variants";

/*
 * The calendar caption's month and year buttons and the month and year views they open (spec
 * §6.2), rendered by `CalendarBase`, which owns the state. Both views are a page of 12 cells in 3
 * rows of 4, addressed by an ordinal: a month is `year * 12 + monthIndex`, a year is the year
 * itself. A page always starts at a multiple of 12 (the month view shows one year, the year view
 * the 12-year block `floor(year / 12) * 12`), so paging, clamping and keyboard moves are the same
 * arithmetic for both.
 */

/**
 * A label that includes a value: a function of the value, or a string prefix (the name is then
 * `${prefix}, ${value}`).
 */
export type CalendarValueLabel = string | ((value: string) => string);

/** Translatable strings for the caption buttons and the month and year views. */
export interface CalendarViewLabels {
  /** The caption's month button, given the caption ("September 2026"). @default "Choose month" */
  chooseMonth?: CalendarValueLabel;
  /** The caption's year button, given the year ("2026"). @default "Choose year" */
  chooseYear?: CalendarValueLabel;
  /** The month view's paging buttons. @default "Previous year" */
  previousYear?: string;
  /** @default "Next year" */
  nextYear?: string;
  /** The year view's paging buttons. @default "Previous 12 years" */
  previousYears?: string;
  /** @default "Next 12 years" */
  nextYears?: string;
  /** The month view's grid, given the year ("2026"). @default "Months" */
  monthGrid?: CalendarValueLabel;
  /** The year view's grid, given the range ("2016 – 2027"). @default "Years" */
  yearGrid?: CalendarValueLabel;
}

export function valueLabel(label: CalendarValueLabel | undefined, fallback: string, value: string) {
  return typeof label === "function" ? label(value) : `${label ?? fallback}, ${value}`;
}

/** The `Intl` formatters the caption and the views need (built once per locale by the base). */
export interface CalendarViewFormatters {
  /** "September 2026" */
  caption: Intl.DateTimeFormat;
  /** "September", standalone */
  monthName: Intl.DateTimeFormat;
  /** "Sep", standalone */
  shortMonth: Intl.DateTimeFormat;
  /** Whether the locale's caption puts the year first (ja-JP "2026年9月"). */
  yearFirst: boolean;
  yearOf: (year: number) => string;
  /** "2016 – 2027" for the page starting at `from`. */
  yearRange: (from: number) => string;
}

/** The calendar's current view: the day grid, or a month/year view in one pane. */
export type CalendarView = { kind: "day" } | CalendarPaneView;

export interface CalendarPaneView {
  kind: "month" | "year";
  /** The pane (0 or 1 with two months) showing the view. */
  pane: number;
  /** The ordinal holding the view's Tab stop; its page is the one shown. */
  focus: number;
}

export const PAGE_SIZE = 12;
const COLUMNS = 4;

/** The first ordinal of the page holding `ordinal`. */
export const pageStart = (ordinal: number) => Math.floor(ordinal / PAGE_SIZE) * PAGE_SIZE;

export const monthOrdinal = (date: Date) => date.getFullYear() * 12 + date.getMonth();
export const monthFromOrdinal = (ordinal: number) =>
  new Date(Math.floor(ordinal / 12), ordinal % 12, 1);

/** The enabled ordinals: those not entirely outside `min` / `max`. */
export interface OrdinalBounds {
  low: number;
  high: number;
}

export function ordinalBounds(
  kind: "month" | "year",
  min: Date | null | undefined,
  max: Date | null | undefined,
): OrdinalBounds {
  const ordinal = kind === "month" ? monthOrdinal : (date: Date) => date.getFullYear();
  return {
    low: min ? ordinal(min) : Number.NEGATIVE_INFINITY,
    high: max ? ordinal(max) : Number.POSITIVE_INFINITY,
  };
}

export const clampOrdinal = (ordinal: number, { low, high }: OrdinalBounds) =>
  Math.min(Math.max(ordinal, low), high);

/**
 * The ordinal a key moves to from `ordinal` (unclamped), or `null` for keys the view doesn't
 * handle. Alt/Ctrl/Meta combinations are left to the browser, as in the day grid.
 */
function viewKeyTarget(event: KeyboardEvent<HTMLElement>, ordinal: number): number | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
  switch (event.key) {
    case "ArrowLeft":
      return ordinal + (rtl ? 1 : -1);
    case "ArrowRight":
      return ordinal + (rtl ? -1 : 1);
    case "ArrowUp":
      return ordinal - COLUMNS;
    case "ArrowDown":
      return ordinal + COLUMNS;
    case "Home":
      return pageStart(ordinal);
    case "End":
      return pageStart(ordinal) + PAGE_SIZE - 1;
    case "PageUp":
      return ordinal - PAGE_SIZE;
    case "PageDown":
      return ordinal + PAGE_SIZE;
    default:
      return null;
  }
}

const navClasses = buttonVariants({ variant: "ghost", color: "neutral", size: "icon-sm" });

/**
 * The header's previous/next button. Disabled with `aria-disabled` (still focusable, clicks
 * ignored), so paging to a bound doesn't drop focus to `<body>`.
 */
export function CalendarNavButton({
  direction,
  label,
  disabled,
  onPage,
}: {
  direction: "prev" | "next";
  label: string;
  disabled: boolean;
  onPage: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      data-slot={`calendar-${direction}`}
      aria-label={label}
      aria-disabled={disabled || undefined}
      data-disabled={disabled ? "" : undefined}
      className={navClasses}
      onClick={() => {
        if (!disabled) onPage();
      }}
    >
      <Icon className="rtl:-scale-x-100" />
    </button>
  );
}

/** The day view's visible caption: the month and year buttons, in the locale's order. */
export function CalendarCaptionButtons({
  month,
  labels,
  formatters,
  onOpen,
}: {
  month: Date;
  labels: CalendarViewLabels | undefined;
  formatters: CalendarViewFormatters;
  onOpen: (kind: "month" | "year") => void;
}) {
  const year = formatters.yearOf(month.getFullYear());
  const monthButton = (
    <button
      key="month"
      type="button"
      data-slot="calendar-month-button"
      aria-label={valueLabel(labels?.chooseMonth, "Choose month", formatters.caption.format(month))}
      className={calendarCaptionButtonClasses}
      onClick={() => onOpen("month")}
    >
      {formatters.monthName.format(month)}
    </button>
  );
  const yearButton = (
    <button
      key="year"
      type="button"
      data-slot="calendar-year-button"
      aria-label={valueLabel(labels?.chooseYear, "Choose year", year)}
      className={calendarCaptionButtonClasses}
      onClick={() => onOpen("year")}
    >
      {year}
    </button>
  );
  return (
    <div className={calendarCaptionGroupClasses}>
      {formatters.yearFirst ? [yearButton, monthButton] : [monthButton, yearButton]}
    </div>
  );
}

/**
 * A pane's header in the month or year view: paging by a year (or 12 years) around the year
 * button (month view) or the page's range as text (year view).
 */
export function CalendarViewHeader({
  view,
  bounds,
  labels,
  formatters,
  onFocusChange,
  onOpenYears,
}: {
  view: CalendarPaneView;
  bounds: OrdinalBounds;
  labels: CalendarViewLabels | undefined;
  formatters: CalendarViewFormatters;
  /** Moves the Tab stop (and so the page) without moving focus. */
  onFocusChange: (ordinal: number) => void;
  onOpenYears: (year: number) => void;
}) {
  const start = pageStart(view.focus);
  const page = (delta: number) => onFocusChange(clampOrdinal(view.focus + delta, bounds));
  const isMonth = view.kind === "month";
  const year = Math.floor(start / 12);
  return (
    <>
      <CalendarNavButton
        direction="prev"
        label={
          isMonth
            ? (labels?.previousYear ?? "Previous year")
            : (labels?.previousYears ?? "Previous 12 years")
        }
        disabled={start - 1 < bounds.low}
        onPage={() => page(-PAGE_SIZE)}
      />
      {isMonth ? (
        <button
          type="button"
          data-slot="calendar-year-button"
          aria-label={valueLabel(labels?.chooseYear, "Choose year", formatters.yearOf(year))}
          className={calendarCaptionButtonClasses}
          onClick={() => onOpenYears(year)}
        >
          {formatters.yearOf(year)}
        </button>
      ) : (
        <span data-slot="calendar-year-range" className={calendarYearRangeClasses}>
          {formatters.yearRange(start)}
        </span>
      )}
      <CalendarNavButton
        direction="next"
        label={isMonth ? (labels?.nextYear ?? "Next year") : (labels?.nextYears ?? "Next 12 years")}
        disabled={start + PAGE_SIZE > bounds.high}
        onPage={() => page(PAGE_SIZE)}
      />
    </>
  );
}

export interface CalendarViewGridProps {
  view: CalendarPaneView;
  /** The pane's visible month (selected in the month view; its year selected in the year view). */
  month: Date;
  today: Date;
  bounds: OrdinalBounds;
  labels: CalendarViewLabels | undefined;
  formatters: CalendarViewFormatters;
  /** The id of a cell's button (the base focuses it after a move). */
  itemId: (ordinal: number) => string;
  /** Moves the Tab stop and focus to `ordinal`. */
  onFocusMove: (ordinal: number) => void;
  onChoose: (ordinal: number) => void;
}

/**
 * A page of 12 months or years as a `role="grid"` table of 3 rows × 4 gridcells, each holding a
 * button: the day grid's pattern (roving tabindex, `aria-selected` on the gridcell, `aria-disabled`
 * buttons that stay focusable, keys clamped at `min` / `max`), in the day grid's footprint.
 */
export function CalendarViewGrid({
  view,
  month,
  today,
  bounds,
  labels,
  formatters,
  itemId,
  onFocusMove,
  onChoose,
}: CalendarViewGridProps) {
  const { kind, focus } = view;
  const isMonth = kind === "month";
  const start = pageStart(focus);
  const selected = isMonth ? monthOrdinal(month) : month.getFullYear();
  const current = isMonth ? monthOrdinal(today) : today.getFullYear();
  const label = isMonth
    ? valueLabel(labels?.monthGrid, "Months", formatters.yearOf(Math.floor(start / 12)))
    : valueLabel(labels?.yearGrid, "Years", formatters.yearRange(start));
  const rows = Array.from({ length: PAGE_SIZE / COLUMNS }, (_, row) =>
    Array.from({ length: COLUMNS }, (_, column) => start + row * COLUMNS + column),
  );

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, ordinal: number) => {
    const target = viewKeyTarget(event, ordinal);
    if (target === null) return;
    event.preventDefault();
    onFocusMove(clampOrdinal(target, bounds));
  };

  return (
    <table
      // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the APG grid pattern, as the day grid.
      role="grid"
      aria-label={label}
      data-slot={`calendar-${kind}-grid`}
      className={calendarViewGridClasses}
    >
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((ordinal) => {
              const disabled = ordinal < bounds.low || ordinal > bounds.high;
              const isSelected = ordinal === selected;
              const isCurrent = ordinal === current;
              const date = isMonth ? monthFromOrdinal(ordinal) : null;
              return (
                // biome-ignore lint/a11y/useFocusableInteractive: focus lives on the button inside (APG grid).
                <td
                  key={ordinal}
                  // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the APG grid pattern, as the day grid.
                  role="gridcell"
                  aria-selected={isSelected || undefined}
                  data-slot="calendar-view-cell"
                  className={calendarViewCellClasses}
                >
                  <button
                    type="button"
                    id={itemId(ordinal)}
                    tabIndex={ordinal === focus ? 0 : -1}
                    // A month reads with its year ("September 2026"); a year is its own name.
                    aria-label={date ? formatters.caption.format(date) : undefined}
                    aria-current={isCurrent ? "date" : undefined}
                    aria-disabled={disabled || undefined}
                    data-slot={`calendar-${kind}-item`}
                    data-current={isCurrent ? "" : undefined}
                    data-selected={isSelected ? "" : undefined}
                    data-disabled={disabled ? "" : undefined}
                    className={calendarViewItemClasses({
                      current: isCurrent,
                      selected: isSelected,
                      disabled,
                    })}
                    onClick={() => {
                      if (!disabled) onChoose(ordinal);
                    }}
                    onKeyDown={(event) => onKeyDown(event, ordinal)}
                    onFocus={() => {
                      if (ordinal !== focus) onFocusMove(ordinal);
                    }}
                  >
                    {date ? formatters.shortMonth.format(date) : formatters.yearOf(ordinal)}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
