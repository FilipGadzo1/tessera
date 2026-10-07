import { describe, expect, it } from "vitest";
import type { HourCycle } from "./time";
import {
  dayPeriodFromKey,
  getDayPeriodLabels,
  getTimeSegmentLabel,
  getTimeSegmentOrder,
  parseTimeString,
  stepTimeSegment,
  type TimeSegmentType,
  timeSegmentBounds,
  timeSegmentSteps,
  timeSegmentsToValue,
  timeValueToSegments,
  typeTimeDigit,
} from "./time-segments";

/** The order as a compact string: "hour : minute   dayPeriod", literals without bidi marks. */
const orderOf = (
  locale: string,
  hourCycle: HourCycle,
  granularity: "minute" | "second" = "minute",
) =>
  getTimeSegmentOrder(locale, { hourCycle, granularity })
    .map((part) => (part.type === "literal" ? part.value.replace(/\p{Cf}/gu, "") : part.type))
    .join(" ");

/** The day-period text `Intl` gives at `hour` (UTC), for expectations taken from the engine. */
const intlDayPeriod = (locale: string, hour: number) =>
  new Intl.DateTimeFormat(locale, { hour: "numeric", hourCycle: "h12", timeZone: "UTC" })
    .formatToParts(Date.UTC(2000, 0, 1, hour))
    .find((part) => part.type === "dayPeriod")?.value;

describe("getTimeSegmentOrder", () => {
  it.each([
    ["en-US", "h12", "hour : minute   dayPeriod"],
    ["de-DE", "h23", "hour : minute"],
    ["ko-KR", "h12", "dayPeriod   hour : minute"],
    ["ja-JP", "h11", "dayPeriod hour : minute"],
  ] as const)("%s %s → %s", (locale, hourCycle, expected) => {
    expect(orderOf(locale, hourCycle)).toBe(expected);
  });

  it("ar-EG keeps its literals (merged) and puts the day period after the clock", () => {
    const order = getTimeSegmentOrder("ar-EG", { hourCycle: "h12", granularity: "minute" });
    expect(order.filter((part) => part.type !== "literal").map((part) => part.type)).toEqual([
      "hour",
      "minute",
      "dayPeriod",
    ]);
    const literals = order.flatMap((part) => (part.type === "literal" ? [part.value] : []));
    expect(literals).toHaveLength(2);
    expect(literals[0]?.replace(/\p{Cf}/gu, "")).toBe(":");
  });

  it("second granularity adds the second after the minute", () => {
    expect(orderOf("en-US", "h12", "second")).toBe("hour : minute : second   dayPeriod");
    expect(orderOf("de-DE", "h23", "second")).toBe("hour : minute : second");
  });

  it("merges consecutive literals into one part", () => {
    for (const locale of ["en-US", "ko-KR", "ar-EG", "de-DE"]) {
      const order = getTimeSegmentOrder(locale, { hourCycle: "h12", granularity: "second" });
      order.forEach((part, index) => {
        if (part.type === "literal") expect(order[index + 1]?.type).not.toBe("literal");
      });
    }
  });
});

describe("timeSegmentBounds", () => {
  it.each([
    ["hour", "h12", 1, 12],
    ["hour", "h11", 0, 11],
    ["hour", "h23", 0, 23],
    ["minute", "h12", 0, 59],
    ["second", "h23", 0, 59],
    ["dayPeriod", "h12", 0, 1],
  ] as const)("%s in %s → %i–%i", (type, cycle, min, max) => {
    expect(timeSegmentBounds(type, cycle)).toEqual({ min, max });
  });
});

describe("typeTimeDigit", () => {
  const minute = timeSegmentBounds("minute", "h23");
  const h23 = timeSegmentBounds("hour", "h23");
  const h12 = timeSegmentBounds("hour", "h12");
  const h11 = timeSegmentBounds("hour", "h11");

  it.each([
    // minute: "0"–"5" wait, "6"–"9" advance, two digits advance
    ["minute 0 waits", "", 0, minute, { buffer: "0", value: 0, advance: false }],
    ["minute 5 waits", "", 5, minute, { buffer: "5", value: 5, advance: false }],
    ["minute 6 advances", "", 6, minute, { buffer: "6", value: 6, advance: true }],
    ["minute 9 advances", "", 9, minute, { buffer: "9", value: 9, advance: true }],
    ["minute 4 then 5 → 45", "4", 5, minute, { buffer: "45", value: 45, advance: true }],
    ["minute 0 then 7 → 07", "0", 7, minute, { buffer: "07", value: 7, advance: true }],
    [
      "minute two digits then one starts over",
      "45",
      3,
      minute,
      { buffer: "3", value: 3, advance: false },
    ],
    // h23: "0"–"2" wait, "3"+ advance, "2" then "4" (24) starts over
    ["h23 2 waits", "", 2, h23, { buffer: "2", value: 2, advance: false }],
    ["h23 3 advances", "", 3, h23, { buffer: "3", value: 3, advance: true }],
    ["h23 2 then 1 → 21", "2", 1, h23, { buffer: "21", value: 21, advance: true }],
    ["h23 2 then 4 starts over", "2", 4, h23, { buffer: "4", value: 4, advance: true }],
    ["h23 0 waits with value 0", "", 0, h23, { buffer: "0", value: 0, advance: false }],
    // h12: "0" is empty and waits, "1" waits (10–12), "2"+ advance
    ["h12 0 is empty and waits", "", 0, h12, { buffer: "0", value: null, advance: false }],
    ["h12 1 waits", "", 1, h12, { buffer: "1", value: 1, advance: false }],
    ["h12 2 advances", "", 2, h12, { buffer: "2", value: 2, advance: true }],
    ["h12 1 then 2 → 12", "1", 2, h12, { buffer: "12", value: 12, advance: true }],
    ["h12 1 then 3 starts over", "1", 3, h12, { buffer: "3", value: 3, advance: true }],
    ["h12 0 then 5 → 05", "0", 5, h12, { buffer: "05", value: 5, advance: true }],
    // h11: "0" is a value and waits (00–09 / 10–11), "1" waits, "2"+ advance
    ["h11 0 waits with value 0", "", 0, h11, { buffer: "0", value: 0, advance: false }],
    ["h11 0 then 5 → 05", "0", 5, h11, { buffer: "05", value: 5, advance: true }],
    ["h11 1 then 1 → 11", "1", 1, h11, { buffer: "11", value: 11, advance: true }],
    ["h11 1 then 2 starts over", "1", 2, h11, { buffer: "2", value: 2, advance: true }],
  ] as const)("%s", (_, buffer, digit, bounds, expected) => {
    expect(typeTimeDigit(buffer, digit, bounds)).toEqual(expected);
  });
});

describe("stepTimeSegment", () => {
  const minute = { min: 0, max: 59 };
  const h12 = { min: 1, max: 12 };

  it("wraps within the bounds and never carries", () => {
    expect(stepTimeSegment(59, 1, minute)).toBe(0);
    expect(stepTimeSegment(0, -1, minute)).toBe(59);
    expect(stepTimeSegment(12, 1, h12)).toBe(1);
    expect(stepTimeSegment(1, -1, h12)).toBe(12);
    expect(stepTimeSegment(50, 15, minute)).toBe(5);
    expect(stepTimeSegment(5, -15, minute)).toBe(50);
  });

  it("an empty segment goes to the first grid value on ↑ and the last on ↓", () => {
    expect(stepTimeSegment(null, 1, minute)).toBe(0);
    expect(stepTimeSegment(null, -1, minute)).toBe(59);
    expect(stepTimeSegment(null, 1, h12)).toBe(1);
    expect(stepTimeSegment(null, -1, h12)).toBe(12);
    expect(stepTimeSegment(null, 1, { min: 0, max: 1 })).toBe(0);
    expect(stepTimeSegment(null, -1, { min: 0, max: 1 })).toBe(1);
    expect(stepTimeSegment(null, 1, minute, 15, 10)).toBe(10);
    expect(stepTimeSegment(null, -1, minute, 15, 10)).toBe(55);
  });

  it("snaps to the step grid both ways from an off-grid value (step 15, offset 0)", () => {
    expect(stepTimeSegment(7, 1, minute, 15)).toBe(15);
    expect(stepTimeSegment(7, -1, minute, 15)).toBe(0);
    expect(stepTimeSegment(15, 1, minute, 15)).toBe(30);
    expect(stepTimeSegment(45, 1, minute, 15)).toBe(0);
    expect(stepTimeSegment(0, -1, minute, 15)).toBe(45);
    expect(stepTimeSegment(50, 1, minute, 15)).toBe(0);
  });

  it("an offset grid (step 15, offset 10: 10, 25, 40, 55)", () => {
    expect(stepTimeSegment(7, 1, minute, 15, 10)).toBe(10);
    expect(stepTimeSegment(7, -1, minute, 15, 10)).toBe(55);
    expect(stepTimeSegment(10, 1, minute, 15, 10)).toBe(25);
    expect(stepTimeSegment(55, 1, minute, 15, 10)).toBe(10);
    expect(stepTimeSegment(30, -1, minute, 15, 10)).toBe(25);
  });

  it("a delta of several grid steps moves that many (PageUp 15 with step 5)", () => {
    expect(stepTimeSegment(10, 15, minute, 5)).toBe(25);
    expect(stepTimeSegment(10, -15, minute, 5)).toBe(55);
    // A delta below the step still moves one grid step.
    expect(stepTimeSegment(0, 15, minute, 30)).toBe(30);
    expect(stepTimeSegment(30, -15, minute, 30)).toBe(0);
  });

  it("a step at least the range pins the segment to its grid value", () => {
    expect(stepTimeSegment(0, 1, minute, 60)).toBe(0);
    expect(stepTimeSegment(0, -1, minute, 60)).toBe(0);
    expect(stepTimeSegment(37, 1, minute, 60)).toBe(0);
    expect(stepTimeSegment(null, -1, minute, 60, 20)).toBe(20);
    expect(stepTimeSegment(5, 1, minute, 60, 20)).toBe(20);
  });
});

describe("timeSegmentSteps", () => {
  it("step 60 (default): minutes and hours by 1, seconds pinned", () => {
    expect(timeSegmentSteps(60)).toEqual({
      hour: { step: 1, offset: 0 },
      minute: { step: 1, offset: 0 },
      second: { step: 60, offset: 0 },
    });
  });

  it("step 900 with min 09:10: minutes by 15 on the grid 10, 25, 40, 55", () => {
    expect(timeSegmentSteps(900, "09:10")).toEqual({
      hour: { step: 1, offset: 0 },
      minute: { step: 15, offset: 10 },
      second: { step: 60, offset: 0 },
    });
    expect(timeSegmentSteps(900)).toMatchObject({ minute: { step: 15, offset: 0 } });
  });

  it("step 3600: minutes pinned to min's minutes (00 without min), hours by 1", () => {
    expect(timeSegmentSteps(3600)).toEqual({
      hour: { step: 1, offset: 0 },
      minute: { step: 60, offset: 0 },
      second: { step: 60, offset: 0 },
    });
    expect(timeSegmentSteps(3600, "08:30")).toMatchObject({ minute: { step: 60, offset: 30 } });
  });

  it("step 5400 (90 minutes): minutes by gcd(90, 60) = 30, hours by 1", () => {
    expect(timeSegmentSteps(5400)).toEqual({
      hour: { step: 1, offset: 0 },
      minute: { step: 30, offset: 0 },
      second: { step: 60, offset: 0 },
    });
  });

  it("step 7200: hours by 2 from min's hour", () => {
    expect(timeSegmentSteps(7200, "09:00")).toMatchObject({ hour: { step: 2, offset: 1 } });
  });

  it("step 30 (seconds): seconds by 30 from min's seconds, minutes by 1", () => {
    expect(timeSegmentSteps(30)).toEqual({
      hour: { step: 1, offset: 0 },
      minute: { step: 1, offset: 0 },
      second: { step: 30, offset: 0 },
    });
    expect(timeSegmentSteps(30, "10:00:15")).toMatchObject({ second: { step: 30, offset: 15 } });
  });

  it("an invalid step behaves as 60", () => {
    expect(timeSegmentSteps(0)).toEqual(timeSegmentSteps(60));
    expect(timeSegmentSteps(Number.NaN)).toEqual(timeSegmentSteps(60));
  });
});

describe("timeSegmentsToValue / timeValueToSegments", () => {
  const pad = (n: number) => String(n).padStart(2, "0");

  it.each(["h12", "h11", "h23"] as const)("round-trips all 1440 minutes in %s", (cycle) => {
    for (let minutes = 0; minutes < 1440; minutes++) {
      const value = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
      const segments = timeValueToSegments(value, cycle);
      const { min, max } = timeSegmentBounds("hour", cycle);
      expect(segments.hour).toBeGreaterThanOrEqual(min);
      expect(segments.hour).toBeLessThanOrEqual(max);
      expect(timeSegmentsToValue(segments, cycle, "minute")).toBe(value);
    }
  });

  it("h12: 12 AM is 00, 12 PM is 12; h11: 0 PM is 12", () => {
    expect(timeValueToSegments("00:15", "h12")).toEqual({
      hour: 12,
      minute: 15,
      second: 0,
      dayPeriod: 0,
    });
    expect(timeValueToSegments("12:15", "h12")).toMatchObject({ hour: 12, dayPeriod: 1 });
    expect(timeValueToSegments("12:15", "h11")).toMatchObject({ hour: 0, dayPeriod: 1 });
    expect(timeValueToSegments("21:45", "h23")).toMatchObject({ hour: 21, dayPeriod: null });
  });

  it("second granularity carries the seconds; minute granularity drops them", () => {
    const segments = timeValueToSegments("21:45:30", "h12");
    expect(timeSegmentsToValue(segments, "h12", "second")).toBe("21:45:30");
    expect(timeSegmentsToValue(segments, "h12", "minute")).toBe("21:45");
  });

  it("is null unless every needed segment is set", () => {
    const full = { hour: 9, minute: 30, second: 5, dayPeriod: 1 as const };
    expect(timeSegmentsToValue(full, "h12", "minute")).toBe("21:30");
    expect(timeSegmentsToValue({ ...full, hour: null }, "h12", "minute")).toBeNull();
    expect(timeSegmentsToValue({ ...full, minute: null }, "h23", "minute")).toBeNull();
    expect(timeSegmentsToValue({ ...full, dayPeriod: null }, "h12", "minute")).toBeNull();
    expect(timeSegmentsToValue({ ...full, dayPeriod: null }, "h23", "minute")).toBe("09:30");
    expect(timeSegmentsToValue({ ...full, second: null }, "h23", "second")).toBeNull();
    expect(timeSegmentsToValue({ ...full, second: null }, "h23", "minute")).toBe("09:30");
  });

  it("null and an unparsable value give empty segments", () => {
    const empty = { hour: null, minute: null, second: null, dayPeriod: null };
    expect(timeValueToSegments(null, "h12")).toEqual(empty);
    expect(timeValueToSegments("9:30", "h12")).toEqual(empty);
  });
});

describe("day periods", () => {
  it("getDayPeriodLabels: the locale's AM / PM texts", () => {
    expect(getDayPeriodLabels("en-US", "h12")).toEqual(["AM", "PM"]);
    expect(getDayPeriodLabels("ko-KR", "h12")).toEqual([
      intlDayPeriod("ko-KR", 9),
      intlDayPeriod("ko-KR", 21),
    ]);
    expect(getDayPeriodLabels("ko-KR", "h12")).toEqual(["오전", "오후"]);
    // A 24-hour cycle still names the periods (de-DE with a 12-hour clock says AM / PM).
    expect(getDayPeriodLabels("de-DE", "h23")).toEqual(["AM", "PM"]);
  });

  it("dayPeriodFromKey: a / p always, the labels' first letters when they differ", () => {
    const en: [string, string] = ["AM", "PM"];
    expect(dayPeriodFromKey("a", en)).toBe(0);
    expect(dayPeriodFromKey("A", en)).toBe(0);
    expect(dayPeriodFromKey("p", en)).toBe(1);
    expect(dayPeriodFromKey("P", en)).toBe(1);
    expect(dayPeriodFromKey("x", en)).toBeNull();
    expect(dayPeriodFromKey("1", en)).toBeNull();
    const ar: [string, string] = ["ص", "م"];
    expect(dayPeriodFromKey("ص", ar)).toBe(0);
    expect(dayPeriodFromKey("م", ar)).toBe(1);
    // ko's 오전 / 오후 share their first character: only a / p work there.
    const ko: [string, string] = ["오전", "오후"];
    expect(dayPeriodFromKey("오", ko)).toBeNull();
    expect(dayPeriodFromKey("a", ko)).toBe(0);
    expect(dayPeriodFromKey("p", ko)).toBe(1);
  });
});

describe("getTimeSegmentLabel", () => {
  it("names the segments from Intl.DisplayNames", () => {
    const names = new Intl.DisplayNames("de-DE", { type: "dateTimeField" });
    const types: TimeSegmentType[] = ["hour", "minute", "second", "dayPeriod"];
    for (const type of types) {
      expect(getTimeSegmentLabel(type, "de-DE")).toBe(names.of(type));
    }
    expect(getTimeSegmentLabel("hour", "de-DE")).toBe("Stunde");
  });

  it("falls back to English without Intl.DisplayNames", () => {
    // Removing the built-in for the fallback path (restored below).
    const intl = Intl as unknown as { DisplayNames: unknown };
    const original = intl.DisplayNames;
    intl.DisplayNames = undefined;
    try {
      expect(getTimeSegmentLabel("hour", "de-DE")).toBe("hour");
      expect(getTimeSegmentLabel("minute", "de-DE")).toBe("minute");
      expect(getTimeSegmentLabel("second", "de-DE")).toBe("second");
      expect(getTimeSegmentLabel("dayPeriod", "de-DE")).toBe("AM/PM");
    } finally {
      intl.DisplayNames = original;
    }
  });
});

describe("parseTimeString", () => {
  it.each([
    ["09:30", "en-US", "h12", "09:30"],
    ["21:45:30", "en-US", "h12", "21:45:30"],
    ["9:30 PM", "en-US", "h12", "21:30"],
    ["9:30pm", "en-US", "h12", "21:30"],
    ["9:30 p.m.", "en-US", "h12", "21:30"],
    ["9:30 a", "en-US", "h12", "09:30"],
    ["12:15 am", "en-US", "h12", "00:15"],
    ["12:15 PM", "en-US", "h12", "12:15"],
    ["21.30", "de-DE", "h23", "21:30"],
    ["9:30", "de-DE", "h23", "09:30"],
    ["  7:05  ", "en-US", "h12", "07:05"],
    ["٩:٣٠ م", "ar-EG", "h12", "21:30"],
    ["오후 9:30", "ko-KR", "h12", "21:30"],
    ["25:00", "en-US", "h12", null],
    ["12:60", "en-US", "h12", null],
    ["13:00 PM", "en-US", "h12", null],
    ["9", "en-US", "h12", null],
    ["1:2:3:4", "en-US", "h12", null],
    ["930", "en-US", "h12", null],
    ["9:30 xm", "en-US", "h12", null],
    ["not a time", "en-US", "h12", null],
    ["", "en-US", "h12", null],
  ] as const)("%j (%s) → %s", (text, locale, cycle, expected) => {
    expect(parseTimeString(text, locale, cycle)).toBe(expected);
  });
});
