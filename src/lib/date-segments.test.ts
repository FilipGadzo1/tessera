import { describe, expect, it } from "vitest";
import {
  type DateSegmentType,
  dateToSegments,
  getDateSegmentOrder,
  getLocaleDigits,
  getSegmentLabel,
  getSegmentPlaceholder,
  incrementSegment,
  parseDateString,
  parseDigit,
  segmentBounds,
  segmentsToDate,
  typeDigit,
} from "./date-segments";

/** Local calendar day (month is 1-based here, so the tables read like ISO dates). */
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

/** The order as a compact string: "month / day / year" with literals trimmed of bidi marks. */
const orderOf = (locale: string) =>
  getDateSegmentOrder(locale)
    .map((part) => (part.type === "literal" ? part.value.replace(/\p{Cf}/gu, "") : part.type))
    .join(" ");

describe("getDateSegmentOrder", () => {
  it.each([
    ["en-US", "month / day / year"],
    ["en-GB", "day / month / year"],
    ["de-DE", "day . month . year"],
    ["ja-JP", "year / month / day"],
    ["ar-EG", "day / month / year"],
    ["ko-KR", "year .  month .  day ."],
  ])("%s → %s", (locale, expected) => {
    expect(orderOf(locale)).toBe(expected);
  });

  it("uses the Gregorian calendar even where the locale defaults to another (fa-IR is Persian)", () => {
    const types = getDateSegmentOrder("fa-IR")
      .filter((part) => part.type !== "literal")
      .map((part) => part.type);
    expect(types).toEqual(["year", "month", "day"]);
  });

  it("has exactly one of each segment type for the runtime default locale", () => {
    const types = getDateSegmentOrder()
      .filter((part) => part.type !== "literal")
      .map((part) => part.type)
      .sort();
    expect(types).toEqual(["day", "month", "year"]);
  });
});

describe("segmentBounds", () => {
  it.each([
    ["month", {}, 1, 12],
    ["year", {}, 1, 9999],
    ["day", {}, 1, 31],
    ["day", { month: 2 }, 1, 31], // year unknown
    ["day", { year: 2026 }, 1, 31], // month unknown
    ["day", { month: 2, year: 2026 }, 1, 28],
    ["day", { month: 2, year: 2024 }, 1, 29],
    ["day", { month: 2, year: 1900 }, 1, 28],
    ["day", { month: 2, year: 2000 }, 1, 29],
    ["day", { month: 4, year: 2026 }, 1, 30],
    ["day", { month: 2, year: 4 }, 1, 29], // year 4 AD is a leap year (not 1904's rules)
  ] as const)("%s with %o → %i–%i", (type, partial, min, max) => {
    expect(segmentBounds(type as DateSegmentType, partial)).toEqual({ min, max });
  });
});

describe("typeDigit", () => {
  // [type, buffer before, digit, max, → buffer, value, advance]
  it.each([
    // Month: "1" waits for a second digit; "2"–"9" commit and advance; "1"+"0..2" → 10–12.
    ["month", "", 1, 12, "1", 1, false],
    ["month", "", 2, 12, "2", 2, true],
    ["month", "", 9, 12, "9", 9, true],
    ["month", "1", 0, 12, "10", 10, true],
    ["month", "1", 2, 12, "12", 12, true],
    ["month", "1", 3, 12, "3", 3, true], // 13 is out of range: start over with "3"
    ["month", "", 0, 12, "0", null, false], // a leading zero waits
    ["month", "0", 9, 12, "09", 9, true],
    ["month", "0", 0, 12, "00", null, false],
    // Day: "4"–"9" advance at once; "1"–"3" wait.
    ["day", "", 1, 31, "1", 1, false],
    ["day", "", 3, 31, "3", 3, false],
    ["day", "", 4, 31, "4", 4, true],
    ["day", "3", 1, 31, "31", 31, true],
    ["day", "3", 2, 31, "2", 2, false], // 32 is out of range: start over with "2"
    ["day", "", 3, 28, "3", 3, true], // February: 30+ can't follow, so "3" is final
    ["day", "2", 9, 28, "9", 9, true], // 29 > 28 starts over
    // Year: four digits, then advance.
    ["year", "", 2, 9999, "2", 2, false],
    ["year", "2", 0, 9999, "20", 20, false],
    ["year", "20", 2, 9999, "202", 202, false],
    ["year", "202", 6, 9999, "2026", 2026, true],
    ["year", "2026", 1, 9999, "1", 1, false], // a fifth digit starts over
    ["year", "", 0, 9999, "0", null, false],
  ] as const)(
    "%s: %j + %i (max %i) → %j = %j, advance %j",
    (type, buffer, digit, max, nextBuffer, value, advance) => {
      expect(typeDigit(buffer, digit, type, max)).toEqual({ buffer: nextBuffer, value, advance });
    },
  );

  it("defaults max to the segment's widest bound", () => {
    expect(typeDigit("", 3, "day")).toEqual({ buffer: "3", value: 3, advance: false });
    expect(typeDigit("1", 3, "month")).toEqual({ buffer: "3", value: 3, advance: true });
  });
});

describe("incrementSegment", () => {
  it.each([
    [5, "month", 1, 6],
    [12, "month", 1, 1], // wraps up
    [1, "month", -1, 12], // wraps down
    [2026, "year", 10, 2036],
    [9995, "year", 10, 6], // wraps past 9999
    [3, "year", -10, 9992],
  ] as const)("%i %s %i → %i", (value, type, delta, expected) => {
    expect(incrementSegment(value, type, delta, segmentBounds(type, {}))).toBe(expected);
  });

  it("wraps a day within the month's bounds", () => {
    expect(incrementSegment(30, "day", 1, { min: 1, max: 30 })).toBe(1);
    expect(incrementSegment(1, "day", -1, { min: 1, max: 28 })).toBe(28);
    expect(incrementSegment(25, "day", 7, { min: 1, max: 30 })).toBe(2);
    expect(incrementSegment(28, "day", 7, { min: 1, max: 31 })).toBe(4);
  });

  it("starts an empty segment at today's value (clamped), without stepping", () => {
    const today = d(2026, 9, 25);
    expect(incrementSegment(null, "month", 1, { min: 1, max: 12 }, today)).toBe(9);
    expect(incrementSegment(null, "day", -1, { min: 1, max: 31 }, today)).toBe(25);
    expect(incrementSegment(null, "day", 1, { min: 1, max: 28 }, d(2026, 1, 31))).toBe(28);
    expect(incrementSegment(null, "year", 10, { min: 1, max: 9999 }, today)).toBe(2026);
  });
});

describe("segmentsToDate / dateToSegments", () => {
  it("assembles a local-midnight date when all three segments form a real day", () => {
    const date = segmentsToDate({ day: 25, month: 9, year: 2026 });
    expect(date).toEqual(d(2026, 9, 25));
    expect(date?.getHours()).toBe(0);
  });

  it.each([
    [{ day: 30, month: 2, year: 2026 }],
    [{ day: 29, month: 2, year: 2026 }],
    [{ day: 31, month: 4, year: 2026 }],
    [{ day: null, month: 9, year: 2026 }],
    [{ day: 25, month: null, year: 2026 }],
    [{ day: 25, month: 9, year: null }],
    [{ day: 0, month: 9, year: 2026 }],
    [{ day: 25, month: 13, year: 2026 }],
    [{ day: 25, month: 9, year: 0 }],
    [{ day: 25, month: 9, year: 10000 }],
  ])("%o → null", (segments) => {
    expect(segmentsToDate(segments)).toBeNull();
  });

  it("keeps years below 100 literal (not the 1900s)", () => {
    const date = segmentsToDate({ day: 29, month: 2, year: 4 }) as Date;
    expect(date.getFullYear()).toBe(4);
    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(29);
    expect(dateToSegments(date)).toEqual({ day: 29, month: 2, year: 4 });
  });

  it("splits a date (or null) into segments", () => {
    expect(dateToSegments(d(2026, 9, 25))).toEqual({ day: 25, month: 9, year: 2026 });
    expect(dateToSegments(null)).toEqual({ day: null, month: null, year: null });
  });
});

describe("parseDigit", () => {
  it("accepts ASCII digits in every locale and the locale's own digits", () => {
    const en = getLocaleDigits("en-US");
    const ar = getLocaleDigits("ar-EG");
    expect(ar).toEqual(["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"]);
    expect(parseDigit("7", en)).toBe(7);
    expect(parseDigit("7", ar)).toBe(7);
    expect(parseDigit("٧", ar)).toBe(7);
    expect(parseDigit("٠", ar)).toBe(0);
    expect(parseDigit("٧", en)).toBeNull();
    expect(parseDigit("a", en)).toBeNull();
    expect(parseDigit("12", en)).toBeNull();
  });

  it("accepts full-width digits (U+FF10–FF19, a CJK IME's output) in every locale", () => {
    const en = getLocaleDigits("en-US");
    const ja = getLocaleDigits("ja-JP");
    expect(parseDigit("０", en)).toBe(0);
    expect(parseDigit("７", en)).toBe(7);
    expect(parseDigit("９", ja)).toBe(9);
    expect(parseDigit("／", ja)).toBeNull();
    expect(parseDateString("９/２５/２０２６", "en-US")).toEqual(d(2026, 9, 25));
  });
});

describe("parseDateString", () => {
  it.each([
    ["2026-09-25", "en-US", d(2026, 9, 25)],
    ["2026-09-25", "de-DE", d(2026, 9, 25)],
    ["09/25/2026", "en-US", d(2026, 9, 25)],
    [" 9/25/2026 ", "en-US", d(2026, 9, 25)],
    ["25.09.2026", "de-DE", d(2026, 9, 25)],
    ["25/09/2026", "en-GB", d(2026, 9, 25)],
    ["2026/09/25", "ja-JP", d(2026, 9, 25)],
    ["٢٥/٩/٢٠٢٦", "ar-EG", d(2026, 9, 25)],
  ] as const)("%j in %s → a date", (text, locale, expected) => {
    expect(parseDateString(text, locale)).toEqual(expected);
  });

  it.each([
    ["25/09/2026", "en-US"], // month 25
    ["02/30/2026", "en-US"],
    ["2026-02-30", "en-US"],
    ["hello", "en-US"],
    ["09/25", "en-US"],
    ["", "en-US"],
  ])("%j in %s → null", (text, locale) => {
    expect(parseDateString(text, locale)).toBeNull();
  });
});

describe("labels and placeholders", () => {
  it.each([
    ["en-US", "month", "mm"],
    ["en-US", "day", "dd"],
    ["en-US", "year", "yyyy"],
    ["de-DE", "day", "tt"],
    ["de-DE", "month", "mm"],
    ["de-DE", "year", "jjjj"],
    ["fr-FR", "day", "jj"],
    ["fr-FR", "year", "aaaa"],
    ["ru-RU", "day", "дд"],
    ["ja-JP", "year", "yyyy"], // non-alphabetic scripts fall back to the English letters
    ["ar-EG", "day", "dd"],
  ] as const)("%s %s placeholder → %s", (locale, type, expected) => {
    expect(getSegmentPlaceholder(type, locale)).toBe(expected);
  });

  it("names segments from Intl.DisplayNames", () => {
    expect(getSegmentLabel("month", "en-US")).toBe("month");
    expect(getSegmentLabel("day", "de-DE")).toBe("Tag");
    expect(getSegmentLabel("year", "ja-JP")).toBe("年");
  });
});
