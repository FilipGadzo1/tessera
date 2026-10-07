/*
 * Segment helpers for TimeField (spec Phase K §1.3): the locale's hour / minute / second / day
 * period order, bounds per hour cycle, React Aria's typing semantics (auto-advance), stepping on
 * the `step` grid, value assembly and pasted-text parsing. Server-safe, pure (only `Intl`),
 * internal (not exported from the package index; reached through TimeField). The `hour` segment
 * holds the hour as displayed: 1–12 in `h12`, 0–11 in `h11`, 0–23 in `h23`.
 */
import { getLocaleDigits, parseDigit, type SegmentBounds } from "./date-segments";
import { formatTimeValue, type HourCycle, parseTime, type TimeGranularity } from "./time";

export type TimeSegmentType = "hour" | "minute" | "second" | "dayPeriod";

/** One part of the locale's time pattern: an editable segment or a literal separator. */
export type TimeSegmentPart = { type: TimeSegmentType } | { type: "literal"; value: string };

/** The editable values; `null` while a segment is empty. `dayPeriod` 0 is AM, 1 is PM. */
export interface TimeSegments {
  hour: number | null;
  minute: number | null;
  second: number | null;
  dayPeriod: 0 | 1 | null;
}

export const emptyTimeSegments: TimeSegments = {
  hour: null,
  minute: null,
  second: null,
  dayPeriod: null,
};

/** Whether `hourCycle` shows a day period (AM / PM). */
export const hasDayPeriod = (hourCycle: HourCycle) => hourCycle !== "h23";

/**
 * The locale's segment order with its literals, from `formatToParts` of 21:45:30 (UTC) on the
 * `2-digit` pattern in `hourCycle`. Consecutive literals merge into one part.
 */
export function getTimeSegmentOrder(
  locale: string | undefined,
  { hourCycle, granularity }: { hourCycle: HourCycle; granularity: TimeGranularity },
): TimeSegmentPart[] {
  const parts = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: granularity === "second" ? "2-digit" : undefined,
    hourCycle,
    timeZone: "UTC",
  }).formatToParts(Date.UTC(2000, 0, 1, 21, 45, 30));
  const order: TimeSegmentPart[] = [];
  for (const part of parts) {
    if (
      part.type === "hour" ||
      part.type === "minute" ||
      part.type === "second" ||
      part.type === "dayPeriod"
    ) {
      order.push({ type: part.type });
    } else {
      const last = order[order.length - 1];
      if (last?.type === "literal") last.value += part.value;
      else order.push({ type: "literal", value: part.value });
    }
  }
  return order;
}

/** A segment's range: the hour by cycle, minute / second 0–59, the day period 0–1. */
export function timeSegmentBounds(type: TimeSegmentType, hourCycle: HourCycle): SegmentBounds {
  if (type === "hour") {
    if (hourCycle === "h12") return { min: 1, max: 12 };
    if (hourCycle === "h11") return { min: 0, max: 11 };
    return { min: 0, max: 23 };
  }
  if (type === "dayPeriod") return { min: 0, max: 1 };
  return { min: 0, max: 59 };
}

export interface TypedTimeDigit {
  /** The digits typed so far into this segment (the next keystroke appends to it). */
  buffer: string;
  /** The segment's value, or `null` while it is below the minimum ("0" of an `h12` hour). */
  value: number | null;
  /** Whether no further digit could extend the value, so focus moves to the next segment. */
  advance: boolean;
}

/**
 * Appends `digit` to what was typed into the segment so far (React Aria's semantics). When the
 * result exceeds `max` or two digits, typing starts over with `digit`. It advances once another
 * digit couldn't fit: minutes "6"–"9", `h23` hours "3"–"9", `h12` hours "2"–"9", or two digits.
 */
export function typeTimeDigit(
  buffer: string,
  digit: number,
  { min, max }: SegmentBounds,
): TypedTimeDigit {
  let next = buffer + digit;
  if (next.length > 2 || Number(next) > max) next = String(digit);
  const number = Number(next);
  const value = number >= min ? number : null;
  const advance = value !== null && (next.length >= 2 || Number(`${next}0`) > max);
  return { buffer: next, value, advance };
}

/**
 * `value` stepped by `delta`, wrapping within `bounds`, on the grid `offset + k × step`. A delta
 * moves `max(1, round(|delta| / step))` grid values. From an off-grid value the first step up
 * lands on the next grid value and the first step down on the previous one. A step at least the
 * range leaves a single grid value, so the segment is pinned there. An empty segment goes to the
 * first grid value for a positive delta and the last for a negative one. Never carries.
 */
export function stepTimeSegment(
  value: number | null,
  delta: number,
  { min, max }: SegmentBounds,
  step = 1,
  offset = 0,
): number {
  const size = Math.max(1, Math.round(step));
  const grid: number[] = [];
  for (let candidate = min; candidate <= max; candidate++) {
    if ((((candidate - offset) % size) + size) % size === 0) grid.push(candidate);
  }
  if (grid.length === 0) return value ?? min;
  const last = grid.length - 1;
  if (value === null) return (delta < 0 ? grid[last] : grid[0]) as number;
  const moves = Math.max(1, Math.round(Math.abs(delta) / size));
  const sign = delta < 0 ? -1 : 1;
  let index = grid.indexOf(value);
  let remaining = moves;
  if (index === -1) {
    // Off the grid: the first move lands on the neighbouring grid value (wrapping).
    if (sign > 0) {
      const above = grid.findIndex((candidate) => candidate > value);
      index = above === -1 ? 0 : above;
    } else {
      const below = grid.findLastIndex((candidate) => candidate < value);
      index = below === -1 ? last : below;
    }
    remaining -= 1;
  }
  const count = grid.length;
  return grid[(((index + sign * remaining) % count) + count) % count] as number;
}

export interface SegmentStep {
  step: number;
  offset: number;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * Each segment's arrow-key step and grid offset for a native `step` (seconds) counted from `min`
 * (spec §1.3, *Amended in review*): seconds by `gcd(step, 60)` unless the step is whole minutes
 * (then pinned); minutes by `gcd(step / 60, 60)` when the step is whole minutes (pinned for whole
 * hours), else 1; hours by `step / 3600` (capped to a day) when the step is whole hours, else 1.
 * Each offset is `min`'s part modulo its step. An invalid step behaves as 60.
 */
export function timeSegmentSteps(
  step: number,
  min?: string,
): { hour: SegmentStep; minute: SegmentStep; second: SegmentStep } {
  const seconds = Number.isFinite(step) && step > 0 ? Math.round(step) : 60;
  const base = (min === undefined ? null : parseTime(min)) ?? { hour: 0, minute: 0, second: 0 };
  const second =
    seconds % 60 !== 0
      ? { step: gcd(seconds, 60), offset: base.second % gcd(seconds, 60) }
      : { step: 60, offset: base.second };
  let minute = { step: 1, offset: 0 };
  if (seconds % 60 === 0) {
    const size = gcd(seconds / 60, 60);
    minute = { step: size, offset: base.minute % size };
  }
  let hour = { step: 1, offset: 0 };
  if (seconds % 3600 === 0) {
    const size = Math.min(seconds / 3600, 24);
    hour = { step: size, offset: base.hour % size };
  }
  return { hour, minute, second };
}

/**
 * The `"HH:mm[:ss]"` value the segments form, or `null` unless every needed segment is set (the
 * hour, the minute, the second at second granularity, the day period in `h11` / `h12`).
 */
export function timeSegmentsToValue(
  { hour, minute, second, dayPeriod }: TimeSegments,
  hourCycle: HourCycle,
  granularity: TimeGranularity,
): string | null {
  if (hour === null || minute === null) return null;
  if (granularity === "second" && second === null) return null;
  let hour24 = hour;
  if (hasDayPeriod(hourCycle)) {
    if (dayPeriod === null) return null;
    hour24 = (hourCycle === "h12" ? hour % 12 : hour) + 12 * dayPeriod;
  }
  return formatTimeValue({ hour: hour24, minute, second: second ?? 0 }, granularity);
}

/** The segments of `value` in `hourCycle` (all `null` for `null` or an unparsable value). */
export function timeValueToSegments(value: string | null, hourCycle: HourCycle): TimeSegments {
  const parts = value === null ? null : parseTime(value);
  if (!parts) return { ...emptyTimeSegments };
  const { hour, minute, second } = parts;
  if (!hasDayPeriod(hourCycle)) return { hour, minute, second, dayPeriod: null };
  const dayPeriod = hour >= 12 ? 1 : 0;
  const shown = hourCycle === "h12" ? hour % 12 || 12 : hour % 12;
  return { hour: shown, minute, second, dayPeriod };
}

/**
 * The locale's day-period texts `[am, pm]`, from the `dayPeriod` parts at 09:00 and 21:00 on a
 * 12-hour clock (`h11` keeps its own; a 24-hour cycle asks for `h12`).
 */
export function getDayPeriodLabels(
  locale: string | undefined,
  hourCycle: HourCycle,
): [string, string] {
  const format = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    hourCycle: hourCycle === "h11" ? "h11" : "h12",
    timeZone: "UTC",
  });
  const period = (hour: number) =>
    format.formatToParts(Date.UTC(2000, 0, 1, hour)).find((part) => part.type === "dayPeriod")
      ?.value ?? (hour < 12 ? "AM" : "PM");
  return [period(9), period(21)];
}

/**
 * The day period a typed key picks: `a` / `A` → AM and `p` / `P` → PM always; otherwise the first
 * character of a label (compared lower-cased) when the two labels' first characters differ (ko's
 * 오전 / 오후 share one, so only a / p and the arrows work there); else `null`.
 */
export function dayPeriodFromKey(key: string, labels: readonly [string, string]): 0 | 1 | null {
  const char = key.toLocaleLowerCase();
  if (char === "a") return 0;
  if (char === "p") return 1;
  const am = [...labels[0]][0]?.toLocaleLowerCase();
  const pm = [...labels[1]][0]?.toLocaleLowerCase();
  if (!am || !pm || am === pm) return null;
  if (char === am) return 0;
  if (char === pm) return 1;
  return null;
}

const englishNames: Record<TimeSegmentType, string> = {
  hour: "hour",
  minute: "minute",
  second: "second",
  dayPeriod: "AM/PM",
};

/** The segment's localised name ("Stunde", "오전/오후"), from `Intl.DisplayNames`; English otherwise. */
export function getTimeSegmentLabel(type: TimeSegmentType, locale?: string): string {
  try {
    return new Intl.DisplayNames(locale, { type: "dateTimeField" }).of(type) ?? englishNames[type];
  } catch {
    // Runtimes without `dateTimeField` display names (or an invalid locale).
    return englishNames[type];
  }
}

/** An empty time segment's placeholder: two en dashes, as React Aria's. */
export const timeSegmentPlaceholder = "––";

/** Text a day-period marker is compared by: lower-cased, without dots, spaces or bidi marks. */
const markerText = (text: string, locale?: string) =>
  text.replace(/[\s.\p{Cf}]/gu, "").toLocaleLowerCase(locale);

/**
 * A pasted time: strict `HH:mm[:ss]` first; else two or three groups of one or two digits (ASCII
 * or the locale's) with any separators, plus an optional day-period marker (the locale's labels,
 * `am` / `pm` / `a` / `p`, case-insensitive, dots ignored). With a marker the hour is 0–12 on a
 * 12-hour clock, without one 0–23. `null` for anything else.
 */
export function parseTimeString(
  text: string,
  locale: string | undefined,
  hourCycle: HourCycle,
): string | null {
  const trimmed = text.trim();
  if (parseTime(trimmed)) return trimmed;
  const digits = getLocaleDigits(locale);
  const ascii = trimmed.replace(/./gu, (char) => {
    const digit = parseDigit(char, digits);
    return digit === null ? char : String(digit);
  });
  const groups = ascii.match(/\d+/g);
  if (!groups || groups.length < 2 || groups.length > 3) return null;
  if (groups.some((group) => group.length > 2)) return null;
  const rest = markerText(ascii.replace(/[\d:]/g, ""), locale);
  let dayPeriod: 0 | 1 | null = null;
  if (rest !== "") {
    const [am, pm] = getDayPeriodLabels(locale, hourCycle).map((label) =>
      markerText(label, locale),
    );
    if (rest === am || rest === "am" || rest === "a") dayPeriod = 0;
    else if (rest === pm || rest === "pm" || rest === "p") dayPeriod = 1;
    else return null;
  }
  const [hour, minute, second = 0] = groups.map(Number) as [number, number, number?];
  if (minute > 59 || second > 59) return null;
  let hour24 = hour;
  if (dayPeriod !== null) {
    if (hour > 12) return null;
    hour24 = (hour % 12) + 12 * dayPeriod;
  } else if (hour > 23) {
    return null;
  }
  return formatTimeValue(
    { hour: hour24, minute, second },
    groups.length === 3 ? "second" : "minute",
  );
}
