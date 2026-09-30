/*
 * Segment helpers for DateField (spec Phase H §1): the locale's day / month / year order, the
 * React Aria typing semantics (auto-advance), bounds, wrapping and date assembly. Server-safe,
 * pure (only `Intl` and `Date`), internal (not exported from the package index). Segment months
 * are 1-based, as the user types them; years are literal (1–9999, years below 100 are not moved
 * into the 1900s: dates are built with `setFullYear`).
 */
import { daysInMonth, parseISODate } from "./date";

export type DateSegmentType = "day" | "month" | "year";

/** One part of the locale's date pattern: an editable segment or a literal separator. */
export type DateSegmentPart = { type: DateSegmentType } | { type: "literal"; value: string };

/** The editable values; `null` while a segment is empty. `month` is 1-based. */
export interface DateSegments {
  day: number | null;
  month: number | null;
  year: number | null;
}

export interface SegmentBounds {
  min: number;
  max: number;
}

export const emptySegments: DateSegments = { day: null, month: null, year: null };

const YEAR_MIN = 1;
const YEAR_MAX = 9999;
const maxLength: Record<DateSegmentType, number> = { day: 2, month: 2, year: 4 };

/**
 * The locale's segment order with its literals, from `Intl.DateTimeFormat#formatToParts` on the
 * numeric (`2-digit`) pattern. Always Gregorian: a locale whose default calendar differs (fa-IR is
 * Persian) still gets Gregorian day / month / year segments, in its own order.
 */
export function getDateSegmentOrder(locale?: string): DateSegmentPart[] {
  const parts = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    calendar: "gregory",
  }).formatToParts(new Date(2001, 10, 23));
  const order: DateSegmentPart[] = [];
  for (const part of parts) {
    if (part.type === "day" || part.type === "month" || part.type === "year") {
      order.push({ type: part.type });
    } else {
      const last = order[order.length - 1];
      if (last?.type === "literal") last.value += part.value;
      else order.push({ type: "literal", value: part.value });
    }
  }
  return order;
}

/**
 * A segment's range: month 1–12, year 1–9999, day 1–the month's length once both the month and
 * the year are known (31 until then).
 */
export function segmentBounds(
  type: DateSegmentType,
  partial: Partial<DateSegments>,
): SegmentBounds {
  if (type === "month") return { min: 1, max: 12 };
  if (type === "year") return { min: YEAR_MIN, max: YEAR_MAX };
  const { month, year } = partial;
  if (month == null || year == null) return { min: 1, max: 31 };
  return { min: 1, max: daysInMonth(year, month - 1) };
}

export interface TypedDigit {
  /** The digits typed so far into this segment (the next keystroke appends to it). */
  buffer: string;
  /** The segment's value, or `null` while only zeros are typed. */
  value: number | null;
  /** Whether no further digit could extend the value, so focus moves to the next segment. */
  advance: boolean;
}

/**
 * Appends `digit` to what was typed into the segment so far (React Aria's semantics). When the
 * result would exceed `max` or the segment's length, typing starts over with `digit`. It
 * advances once another digit couldn't fit: month "2"–"9" or "10"–"12"; day "4"–"9" (or "3" in
 * February) or two digits; year four digits. `max` defaults to the segment's widest bound.
 */
export function typeDigit(
  buffer: string,
  digit: number,
  type: DateSegmentType,
  max: number = segmentBounds(type, {}).max,
): TypedDigit {
  let next = buffer + digit;
  if (next.length > maxLength[type] || Number(next) > max) next = String(digit);
  const number = Number(next);
  const value = number >= 1 ? number : null;
  const advance = value !== null && (next.length >= maxLength[type] || Number(`${next}0`) > max);
  return { buffer: next, value, advance };
}

/**
 * `value` stepped by `delta`, wrapping within `bounds` (12 → 1, 1 → 12). An empty segment starts
 * at `today`'s value for that segment, clamped into `bounds`, without stepping (as React Aria).
 */
export function incrementSegment(
  value: number | null,
  type: DateSegmentType,
  delta: number,
  bounds: SegmentBounds,
  today: Date = new Date(),
): number {
  const { min, max } = bounds;
  if (value === null) {
    const start = dateToSegments(today)[type] as number;
    return Math.min(Math.max(start, min), max);
  }
  const span = max - min + 1;
  return ((((value - min + delta) % span) + span) % span) + min;
}

/** The local-midnight date the segments form, or `null` unless all three are set and form a real day. */
export function segmentsToDate({ day, month, year }: DateSegments): Date | null {
  if (day === null || month === null || year === null) return null;
  if (year < YEAR_MIN || year > YEAR_MAX || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month - 1)) return null;
  const date = new Date(2000, 0, 1);
  // setFullYear keeps years 0–99 literal (the constructor maps them to 1900–1999).
  date.setFullYear(year, month - 1, day);
  return date;
}

/** The segments of `date`'s local calendar day (all `null` for no date). */
export function dateToSegments(date: Date | null | undefined): DateSegments {
  if (!date) return { ...emptySegments };
  return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
}

/** The locale's ten digit characters, 0–9 (e.g. Arabic-Indic for ar-EG). */
export function getLocaleDigits(locale?: string): string[] {
  const format = new Intl.NumberFormat(locale, { useGrouping: false });
  return Array.from({ length: 10 }, (_, digit) => format.format(digit));
}

/** Full-width digit zero (U+FF10); a CJK IME in full-width mode types U+FF10–FF19. */
const fullWidthZero = 0xff10;

/**
 * The digit `key` stands for: an ASCII digit, a full-width digit (U+FF10–FF19, in every locale),
 * or one of `digits` (the locale's, from `getLocaleDigits`, passed in so a keystroke doesn't build
 * a formatter); `null` otherwise.
 */
export function parseDigit(key: string, digits: readonly string[]): number | null {
  if (/^[0-9]$/.test(key)) return Number(key);
  if (/^[０-９]$/.test(key)) return key.charCodeAt(0) - fullWidthZero;
  const index = digits.indexOf(key);
  return index === -1 ? null : index;
}

/**
 * A pasted date: strict ISO `YYYY-MM-DD`, else three digit groups (ASCII or the locale's digits)
 * read in the locale's segment order ("9/25/2026" in en-US, "25.09.2026" in de-DE). `null` unless
 * it forms a real day.
 */
export function parseDateString(text: string, locale?: string): Date | null {
  const trimmed = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return parseISODate(trimmed);
  const digits = getLocaleDigits(locale);
  const ascii = trimmed.replace(/./gu, (char) => {
    const digit = parseDigit(char, digits);
    return digit === null ? char : String(digit);
  });
  const groups = ascii.match(/\d+/g);
  if (groups?.length !== 3) return null;
  const types = getDateSegmentOrder(locale)
    .filter((part) => part.type !== "literal")
    .map((part) => part.type as DateSegmentType);
  const segments: DateSegments = { ...emptySegments };
  types.forEach((type, index) => {
    segments[type] = Number(groups[index]);
  });
  return segmentsToDate(segments);
}

const englishNames: Record<DateSegmentType, string> = { day: "day", month: "month", year: "year" };

function displayName(type: DateSegmentType, locale?: string): string | undefined {
  try {
    return new Intl.DisplayNames(locale, { type: "dateTimeField" }).of(type);
  } catch {
    // Runtimes without `dateTimeField` display names (or an invalid locale).
    return undefined;
  }
}

/** The segment's localised name ("month", "Monat", "月"), from `Intl.DisplayNames`; English otherwise. */
export function getSegmentLabel(type: DateSegmentType, locale?: string): string {
  return displayName(type, locale) ?? englishNames[type];
}

/**
 * An empty segment's placeholder: the first letter of its localised name, repeated to the
 * segment's length, for alphabetic scripts (Latin, Cyrillic, Greek) — en "mm/dd/yyyy", de
 * "tt.mm.jjjj", fr "jj/mm/aaaa", ru "дд.мм.гггг", matching each locale's usual convention —
 * and the English letters for other scripts (ja, zh, ar, …), where a repeated first character
 * isn't a convention.
 */
export function getSegmentPlaceholder(type: DateSegmentType, locale?: string): string {
  const first = displayName(type, locale)?.[0]?.toLocaleLowerCase(locale);
  const letter =
    first && /\p{Script=Latin}|\p{Script=Cyrillic}|\p{Script=Greek}/u.test(first)
      ? first
      : englishNames[type].charAt(0);
  return letter.repeat(maxLength[type]);
}
