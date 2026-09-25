/*
 * Calendar-day helpers on plain `Date` objects (spec Phase F, "No date library"). A `Date` here
 * stands for a local calendar day: time is ignored and every returned date is a fresh copy at local
 * midnight. Arithmetic goes through the `Date(year, month, day)` constructor, never through
 * milliseconds, so it lands on the right calendar day across DST transitions. Server-safe and
 * internal (not exported from the package index).
 */

/** Day of the week, 0 = Sunday … 6 = Saturday (as `Date#getDay`). */
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A local-midnight copy of `date`. */
export function toDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** True when both are set and fall on the same local calendar day. */
export function isSameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return !!a && !!b && compareDay(a, b) === 0;
}

/** True when both fall in the same local calendar month. */
export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** -1, 0 or 1 as `a`'s calendar day is before, the same as, or after `b`'s (time ignored). */
export function compareDay(a: Date, b: Date): -1 | 0 | 1 {
  const ka = a.getFullYear() * 10000 + a.getMonth() * 100 + a.getDate();
  const kb = b.getFullYear() * 10000 + b.getMonth() * 100 + b.getDate();
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/** `date` plus `amount` calendar days (negative goes back). */
export function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function daysInMonth(year: number, month: number): number {
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, month + 1, 0);
  return date.getDate();
}

/** `date` plus `amount` months, clamping the day to the target month (Jan 31 + 1 → Feb 28/29). */
export function addMonths(date: Date, amount: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  const day = Math.min(date.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
  return new Date(target.getFullYear(), target.getMonth(), day);
}

/** `date` plus `amount` years (Feb 29 → Feb 28 in a common year). */
export function addYears(date: Date, amount: number): Date {
  return addMonths(date, amount * 12);
}

/** The 1st of `date`'s month. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** The first day of `date`'s week, for weeks starting on `weekStartsOn`. */
export function startOfWeek(date: Date, weekStartsOn: WeekDay): Date {
  return addDays(date, -((date.getDay() - weekStartsOn + 7) % 7));
}

/** The last day of `date`'s week, for weeks starting on `weekStartsOn`. */
export function endOfWeek(date: Date, weekStartsOn: WeekDay): Date {
  return addDays(startOfWeek(date, weekStartsOn), 6);
}

/** True when `date` falls between `a` and `b` inclusive, in either order. */
export function isBetweenDays(date: Date, a: Date, b: Date): boolean {
  const [lo, hi] = compareDay(a, b) <= 0 ? [a, b] : [b, a];
  return compareDay(date, lo) >= 0 && compareDay(date, hi) <= 0;
}

/** `date` (as a day) moved into `[min, max]`; either bound may be missing. */
export function clampDay(date: Date, min?: Date | null, max?: Date | null): Date {
  if (min && compareDay(date, min) < 0) return toDay(min);
  if (max && compareDay(date, max) > 0) return toDay(max);
  return toDay(date);
}

interface WeekInfo {
  firstDay: number;
}

type LocaleWithWeekInfo = Intl.Locale & {
  getWeekInfo?: () => WeekInfo;
  weekInfo?: WeekInfo;
};

/**
 * The locale's first day of the week (0 = Sunday), from `Intl.Locale#getWeekInfo()`, falling back
 * to the older `weekInfo` getter, then Monday. Without `locale`, uses the runtime's default.
 */
export function getWeekStartsOn(locale?: string): WeekDay {
  try {
    const info = new Intl.Locale(
      locale ?? new Intl.DateTimeFormat().resolvedOptions().locale,
    ) as LocaleWithWeekInfo;
    const weekInfo = info.getWeekInfo?.() ?? info.weekInfo;
    // Intl numbers the days 1 (Monday) … 7 (Sunday).
    if (weekInfo && weekInfo.firstDay >= 1 && weekInfo.firstDay <= 7) {
      return (weekInfo.firstDay % 7) as WeekDay;
    }
  } catch {
    // Invalid locale tag: fall through to Monday.
  }
  return 1;
}

/**
 * The weeks shown for `month`: always 6 rows of 7 days (so the calendar's height never jumps),
 * starting at the week that contains the 1st.
 */
export function getMonthGrid(month: Date, weekStartsOn: WeekDay): Date[][] {
  const first = startOfWeek(startOfMonth(month), weekStartsOn);
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(first, week * 7 + day)),
  );
}

const pad = (value: number, length: number) => String(value).padStart(length, "0");

/** `YYYY-MM-DD` of `date`'s local calendar day. */
export function toISODate(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}

/** The local-midnight date of a strict `YYYY-MM-DD` string, or `null` if it isn't a real day. */
export function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month - 1)) return null;
  const date = new Date(2000, month - 1, day);
  // setFullYear keeps years 0–99 literal (the constructor maps them to 1900–1999).
  date.setFullYear(year, month - 1, day);
  return date;
}
