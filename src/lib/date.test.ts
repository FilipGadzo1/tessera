import { afterEach, describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";
import {
  addDays,
  addMonths,
  addYears,
  clampDay,
  compareDay,
  endOfWeek,
  getMonthGrid,
  getWeekStartsOn,
  isBetweenDays,
  isSameDay,
  isSameMonth,
  parseISODate,
  regionWeekStartsOn,
  startOfMonth,
  startOfWeek,
  toDay,
  toISODate,
} from "./date";

/** Local calendar day (month is 1-based here, so the tables read like ISO dates). */
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

const isLocalMidnight = (date: Date) =>
  date.getHours() === 0 &&
  date.getMinutes() === 0 &&
  date.getSeconds() === 0 &&
  date.getMilliseconds() === 0;

/**
 * Runs the page in a real DST time zone (CDP `Emulation.setTimezoneOverride`), so the DST cases
 * don't depend on the machine's zone. Cleared after each test.
 */
async function useTimeZone(timezoneId: string) {
  await cdp().send("Emulation.setTimezoneOverride", { timezoneId });
}

afterEach(async () => {
  await cdp().send("Emulation.setTimezoneOverride", { timezoneId: "" });
});

describe("toDay", () => {
  it("returns a local-midnight copy without mutating the input", () => {
    const input = new Date(2026, 8, 25, 17, 45, 12, 345);
    const day = toDay(input);
    expect(isLocalMidnight(day)).toBe(true);
    expect(toISODate(day)).toBe("2026-09-25");
    expect(input.getHours()).toBe(17);
    expect(day).not.toBe(input);
  });
});

describe("isSameDay / isSameMonth / compareDay", () => {
  it.each([
    [new Date(2026, 8, 25, 0, 0), new Date(2026, 8, 25, 23, 59), true],
    [d(2026, 9, 25), d(2026, 9, 26), false],
    [d(2026, 9, 25), d(2025, 9, 25), false],
  ])("isSameDay(%s, %s) is %s", (a, b, expected) => {
    expect(isSameDay(a, b)).toBe(expected);
  });

  it("isSameDay is false for null/undefined", () => {
    expect(isSameDay(null, d(2026, 9, 25))).toBe(false);
    expect(isSameDay(d(2026, 9, 25), undefined)).toBe(false);
  });

  it.each([
    [d(2026, 9, 1), d(2026, 9, 30), true],
    [d(2026, 9, 30), d(2026, 10, 1), false],
    [d(2025, 9, 1), d(2026, 9, 1), false],
  ])("isSameMonth(%s, %s) is %s", (a, b, expected) => {
    expect(isSameMonth(a, b)).toBe(expected);
  });

  it.each([
    [d(2026, 9, 25), d(2026, 9, 26), -1],
    [d(2026, 9, 26), d(2026, 9, 25), 1],
    [new Date(2026, 8, 25, 23), new Date(2026, 8, 25, 1), 0],
    [d(2025, 12, 31), d(2026, 1, 1), -1],
  ])("compareDay(%s, %s) is %i (time ignored)", (a, b, expected) => {
    expect(compareDay(a, b)).toBe(expected);
  });
});

describe("addDays", () => {
  it.each([
    [d(2026, 9, 25), 1, "2026-09-26"],
    [d(2026, 9, 30), 1, "2026-10-01"],
    [d(2026, 12, 31), 1, "2027-01-01"],
    [d(2026, 1, 1), -1, "2025-12-31"],
    [d(2024, 2, 28), 1, "2024-02-29"],
    [d(2025, 2, 28), 1, "2025-03-01"],
    [d(2026, 9, 25), 7, "2026-10-02"],
    [d(2026, 9, 25), -7, "2026-09-18"],
    [d(2026, 9, 25), 0, "2026-09-25"],
  ])("addDays(%s, %i) is %s", (date, n, expected) => {
    const result = addDays(date, n);
    expect(toISODate(result)).toBe(expected);
    expect(isLocalMidnight(result)).toBe(true);
  });

  it.each([
    // America/New_York: DST starts 2026-03-08 (23h day) and ends 2026-11-01 (25h day).
    ["America/New_York", [2026, 3, 7], 1, "2026-03-08"],
    ["America/New_York", [2026, 3, 8], 1, "2026-03-09"],
    ["America/New_York", [2026, 3, 9], -1, "2026-03-08"],
    ["America/New_York", [2026, 10, 31], 1, "2026-11-01"],
    ["America/New_York", [2026, 11, 1], 1, "2026-11-02"],
    ["America/New_York", [2026, 11, 2], -2, "2026-10-31"],
    // Europe/Berlin: DST starts 2026-03-29 and ends 2026-10-25.
    ["Europe/Berlin", [2026, 3, 28], 2, "2026-03-30"],
    ["Europe/Berlin", [2026, 10, 25], 1, "2026-10-26"],
    ["Europe/Berlin", [2026, 10, 26], -1, "2026-10-25"],
  ] as const)(
    "across a DST transition in %s: addDays(%j, %i) is %s at local midnight",
    async (zone, [y, m, day], n, expected) => {
      await useTimeZone(zone);
      // Build the date after switching zones, so it is local midnight in that zone.
      const date = d(y, m, day);
      const result = addDays(date, n);
      expect(toISODate(result)).toBe(expected);
      expect(isLocalMidnight(result)).toBe(true);
    },
  );

  it("walks a whole DST year one day at a time without skipping or repeating a day", async () => {
    await useTimeZone("America/New_York");
    let day = new Date(2026, 0, 1);
    const seen = new Set<string>();
    for (let i = 0; i < 365; i++) {
      expect(isLocalMidnight(day)).toBe(true);
      seen.add(toISODate(day));
      day = addDays(day, 1);
    }
    expect(seen.size).toBe(365);
    expect(toISODate(day)).toBe("2027-01-01");
  });
});

describe("addMonths / addYears", () => {
  it.each([
    [d(2026, 1, 31), 1, "2026-02-28"],
    [d(2024, 1, 31), 1, "2024-02-29"],
    [d(2026, 3, 31), -1, "2026-02-28"],
    [d(2026, 5, 31), 1, "2026-06-30"],
    [d(2026, 9, 25), 1, "2026-10-25"],
    [d(2026, 12, 15), 1, "2027-01-15"],
    [d(2026, 1, 15), -1, "2025-12-15"],
    [d(2026, 9, 25), 12, "2027-09-25"],
    [d(2026, 9, 25), -25, "2024-08-25"],
  ])("addMonths(%s, %i) is %s (day clamped)", (date, n, expected) => {
    const result = addMonths(date, n);
    expect(toISODate(result)).toBe(expected);
    expect(isLocalMidnight(result)).toBe(true);
  });

  it.each([
    [d(2024, 2, 29), 1, "2025-02-28"],
    [d(2024, 2, 29), -1, "2023-02-28"],
    [d(2024, 2, 29), 4, "2028-02-29"],
    [d(2026, 9, 25), -1, "2025-09-25"],
  ])("addYears(%s, %i) is %s (Feb 29 clamps)", (date, n, expected) => {
    expect(toISODate(addYears(date, n))).toBe(expected);
  });
});

describe("startOfMonth / startOfWeek / endOfWeek", () => {
  it("startOfMonth is the 1st at local midnight", () => {
    const result = startOfMonth(new Date(2026, 8, 25, 13));
    expect(toISODate(result)).toBe("2026-09-01");
    expect(isLocalMidnight(result)).toBe(true);
  });

  // 2026-09-25 is a Friday (getDay() 5).
  it.each([
    [0, "2026-09-20", "2026-09-26"],
    [1, "2026-09-21", "2026-09-27"],
    [5, "2026-09-25", "2026-10-01"],
    [6, "2026-09-19", "2026-09-25"],
  ] as const)("week starting on %i: %s … %s", (weekStartsOn, start, end) => {
    expect(toISODate(startOfWeek(d(2026, 9, 25), weekStartsOn))).toBe(start);
    expect(toISODate(endOfWeek(d(2026, 9, 25), weekStartsOn))).toBe(end);
  });
});

describe("isBetweenDays / clampDay", () => {
  it.each([
    [d(2026, 9, 10), d(2026, 9, 1), d(2026, 9, 30), true],
    [d(2026, 9, 10), d(2026, 9, 30), d(2026, 9, 1), true],
    [d(2026, 9, 1), d(2026, 9, 1), d(2026, 9, 30), true],
    [new Date(2026, 8, 30, 22), d(2026, 9, 1), d(2026, 9, 30), true],
    [d(2026, 10, 1), d(2026, 9, 1), d(2026, 9, 30), false],
  ])("isBetweenDays(%s, %s, %s) is %s (inclusive, any order)", (date, a, b, expected) => {
    expect(isBetweenDays(date, a, b)).toBe(expected);
  });

  it.each([
    [d(2026, 9, 10), d(2026, 9, 15), d(2026, 9, 20), "2026-09-15"],
    [d(2026, 9, 25), d(2026, 9, 15), d(2026, 9, 20), "2026-09-20"],
    [d(2026, 9, 17), d(2026, 9, 15), d(2026, 9, 20), "2026-09-17"],
    [d(2026, 9, 1), null, d(2026, 9, 20), "2026-09-01"],
    [d(2026, 9, 30), d(2026, 9, 15), undefined, "2026-09-30"],
  ])("clampDay(%s, %s, %s) is %s", (date, min, max, expected) => {
    expect(toISODate(clampDay(date, min, max))).toBe(expected);
  });
});

describe("getWeekStartsOn", () => {
  it.each([
    ["en-US", 0],
    ["de-DE", 1],
    ["en-GB", 1],
    ["ar-EG", 6],
  ] as const)("%s starts the week on %i", (locale, expected) => {
    expect(getWeekStartsOn(locale)).toBe(expected);
  });

  it("falls back to Monday for an invalid locale", () => {
    expect(getWeekStartsOn("not a locale!")).toBe(1);
  });

  // The region-based CLDR fallback (`regionWeekStartsOn`) only runs when the runtime's
  // `Intl.Locale` exposes no week info at all (Firefox may lack both `getWeekInfo` and
  // `weekInfo`). Chromium (this suite's runtime) does support `getWeekInfo`, so the fallback is
  // exercised directly here instead of through `getWeekStartsOn`.
  describe("regionWeekStartsOn (the Firefox fallback path)", () => {
    it.each([
      ["US", 0],
      ["CA", 0],
      ["MX", 0],
      ["JP", 0],
      ["DE", 1],
      ["GB", 1],
      ["AU", 1],
      ["EG", 6],
      ["SA", 6],
      ["AE", 6],
    ] as const)("region %s starts the week on %i", (region, expected) => {
      expect(regionWeekStartsOn(region)).toBe(expected);
    });

    it("falls back to Monday for an unmapped or missing region", () => {
      expect(regionWeekStartsOn("FR")).toBe(1);
      expect(regionWeekStartsOn(undefined)).toBe(1);
    });
  });
});

describe("getMonthGrid", () => {
  it.each([
    // [month, weekStartsOn, first cell, last cell]
    [d(2026, 9, 1), 0, "2026-08-30", "2026-10-10"],
    [d(2026, 9, 1), 1, "2026-08-31", "2026-10-11"],
    // February 2026 starts on a Sunday and has exactly 4 weeks: still 6 rows.
    [d(2026, 2, 1), 0, "2026-02-01", "2026-03-14"],
    [d(2024, 2, 1), 1, "2024-01-29", "2024-03-10"],
    // A 31-day month starting on Saturday needs all 6 rows (Aug 2026, Sunday start).
    [d(2026, 8, 1), 0, "2026-07-26", "2026-09-05"],
  ] as const)("%s (week starts %i) is 6×7 from %s to %s", (month, weekStartsOn, first, last) => {
    const grid = getMonthGrid(month, weekStartsOn);
    expect(grid).toHaveLength(6);
    for (const week of grid) {
      expect(week).toHaveLength(7);
      expect(week[0]?.getDay()).toBe(weekStartsOn);
    }
    const flat = grid.flat();
    expect(toISODate(flat[0] as Date)).toBe(first);
    expect(toISODate(flat[41] as Date)).toBe(last);
    for (let i = 1; i < flat.length; i++) {
      expect(toISODate(flat[i] as Date)).toBe(toISODate(addDays(flat[i - 1] as Date, 1)));
    }
  });

  it("stays 6×7 with local-midnight days in a DST month", async () => {
    await useTimeZone("America/New_York");
    const flat = getMonthGrid(new Date(2026, 2, 1), 0).flat();
    expect(flat).toHaveLength(42);
    expect(flat.every(isLocalMidnight)).toBe(true);
  });
});

describe("toISODate / parseISODate", () => {
  it.each([
    [d(2026, 9, 25), "2026-09-25"],
    [d(2026, 1, 1), "2026-01-01"],
    [d(2024, 2, 29), "2024-02-29"],
    [new Date(2026, 11, 31, 23, 59), "2026-12-31"],
    [d(987, 3, 4), "0987-03-04"],
  ])("toISODate(%s) is %s (local)", (date, expected) => {
    expect(toISODate(date)).toBe(expected);
  });

  it.each(["2026-09-25", "2024-02-29", "2000-01-01", "0987-03-04", "0045-06-07"])(
    "round trips %s",
    (iso) => {
      const parsed = parseISODate(iso);
      expect(parsed).not.toBeNull();
      expect(isLocalMidnight(parsed as Date)).toBe(true);
      expect(toISODate(parsed as Date)).toBe(iso);
    },
  );

  it.each([
    "",
    "2026-9-25",
    "2026-09-25T00:00",
    "2025-02-29",
    "2026-13-01",
    "2026-00-10",
    "2026-04-31",
    "not a date",
  ])("parseISODate(%j) is null", (value) => {
    expect(parseISODate(value)).toBeNull();
  });
});
