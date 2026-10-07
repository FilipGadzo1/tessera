/*
 * Time-of-day helpers (spec Phase K §1.1). A time is wall-clock data, carried as the string wire
 * format of `<input type="time">`: `"HH:mm"`, or `"HH:mm:ss"` at second granularity. There is no
 * `Date` and no time zone; display formatting runs in UTC on a fixed day, so neither the machine's
 * zone nor a DST gap can shift it. Server-safe: pure functions, no DOM and no dependency.
 */

/** Whether a time carries seconds (`"HH:mm:ss"`) or stops at minutes (`"HH:mm"`). */
export type TimeGranularity = "minute" | "second";

/** `Intl`'s hour cycles (`h24` is read as `h23`). */
export type HourCycle = "h11" | "h12" | "h23";

/** A time of day: `hour` 0–23, `minute` and `second` 0–59. */
export interface TimeParts {
  hour: number;
  minute: number;
  second: number;
}

const DAY_SECONDS = 86400;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Parses a strict `"HH:mm"` / `"HH:mm:ss"` value; anything else (`"9:30"`, `"24:00"`) is `null`. */
export function parseTime(value: string): TimeParts | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? 0 : Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `"HH:mm"`, or `"HH:mm:ss"` at second granularity, zero-padded. */
export function formatTimeValue(parts: TimeParts, granularity: TimeGranularity): string {
  const base = `${pad(parts.hour)}:${pad(parts.minute)}`;
  return granularity === "second" ? `${base}:${pad(parts.second)}` : base;
}

/** Seconds since midnight, or `null` for an unparsable value. */
export function timeToSeconds(value: string): number | null {
  const parts = parseTime(value);
  return parts ? parts.hour * 3600 + parts.minute * 60 + parts.second : null;
}

/** The value `seconds` after midnight, wrapping modulo a day (negative counts back). */
export function secondsToTimeValue(seconds: number, granularity: TimeGranularity): string {
  const s = ((Math.floor(seconds) % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS;
  return formatTimeValue(
    { hour: Math.floor(s / 3600), minute: Math.floor((s % 3600) / 60), second: s % 60 },
    granularity,
  );
}

/** -1, 0 or 1 by time of day; `null` (or an unparsable value) sorts first. Never throws. */
export function compareTime(a: string | null, b: string | null): -1 | 0 | 1 {
  const sa = a === null ? null : timeToSeconds(a);
  const sb = b === null ? null : timeToSeconds(b);
  if (sa === null) return sb === null ? 0 : -1;
  if (sb === null) return 1;
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * The hour cycle `locale` uses, or the 12- / 24-hour variant of it when `hourCycle` is given
 * (ja-JP with `12` is `h11`: 0–11). `h24` is read as `h23`.
 */
export function resolveHourCycle(locale: string, hourCycle?: 12 | 24): HourCycle {
  const resolved = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    hour12: hourCycle === undefined ? undefined : hourCycle === 12,
  }).resolvedOptions().hourCycle;
  return resolved === "h11" || resolved === "h12" ? resolved : "h23";
}

/**
 * The display text of `value` in `locale` ("9:30 AM", "21:30"); `""` for an unparsable value.
 * Formats in UTC on a fixed day, so the result never depends on the machine's zone.
 */
export function formatTime(
  value: string,
  locale: string,
  options: { hourCycle?: 12 | 24; granularity?: TimeGranularity } = {},
): string {
  const parts = parseTime(value);
  if (!parts) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    second: options.granularity === "second" ? "2-digit" : undefined,
    hourCycle: resolveHourCycle(locale, options.hourCycle),
    timeZone: "UTC",
  }).format(Date.UTC(2000, 0, 1, parts.hour, parts.minute, parts.second));
}

/**
 * True when `value` is off the `step` grid counted from `min` (default midnight), as a native
 * `<input type="time">`'s step mismatch. `step` is in seconds (default 60). An unparsable value,
 * or a step that is not a positive finite number, never mismatches.
 */
export function timeStepMismatch(
  value: string,
  { step = 60, min }: { step?: number; min?: string },
): boolean {
  const seconds = timeToSeconds(value);
  if (seconds === null || !Number.isFinite(step) || step <= 0) return false;
  const base = (min === undefined ? null : timeToSeconds(min)) ?? 0;
  return (seconds - base) % step !== 0;
}

/**
 * The values from `min` (default `"00:00"`) to `max` (default `"23:59"`), inclusive, every
 * `slotStep` minutes, without the ones that mismatch `step` (seconds, counted from `min`).
 * A `slotStep` below 1 or not finite gives `[]` (with a dev-only warning).
 */
export function getTimeSlots({
  slotStep,
  min,
  max,
  step,
  granularity = "minute",
}: {
  slotStep: number;
  min?: string;
  max?: string;
  step?: number;
  granularity?: TimeGranularity;
}): string[] {
  if (!Number.isFinite(slotStep) || slotStep < 1) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `getTimeSlots: slotStep must be a finite number of minutes ≥ 1 (got ${slotStep}).`,
      );
    }
    return [];
  }
  const start = (min === undefined ? null : timeToSeconds(min)) ?? 0;
  const end = (max === undefined ? null : timeToSeconds(max)) ?? timeToSeconds("23:59") ?? 0;
  const slots: string[] = [];
  for (let seconds = start; seconds <= end; seconds += slotStep * 60) {
    const value = secondsToTimeValue(seconds, granularity);
    if (!timeStepMismatch(value, { step, min })) slots.push(value);
  }
  return slots;
}
