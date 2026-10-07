import { afterEach, describe, expect, it, vi } from "vitest";
import { cdp } from "vitest/browser";
import {
  compareTime,
  formatTime,
  formatTimeValue,
  getTimeSlots,
  parseTime,
  resolveHourCycle,
  secondsToTimeValue,
  timeStepMismatch,
  timeToSeconds,
} from "./time";

/** The display text `Intl` produces for h:m:s with the given options, formatted in UTC. */
function intlTime(
  locale: string,
  [h, m, s]: [number, number, number],
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    ...options,
  }).format(Date.UTC(2000, 0, 1, h, m, s));
}

afterEach(async () => {
  await cdp().send("Emulation.setTimezoneOverride", { timezoneId: "" });
  vi.restoreAllMocks();
});

describe("parseTime", () => {
  it.each([
    ["00:00", { hour: 0, minute: 0, second: 0 }],
    ["09:30", { hour: 9, minute: 30, second: 0 }],
    ["23:59", { hour: 23, minute: 59, second: 0 }],
    ["21:45:30", { hour: 21, minute: 45, second: 30 }],
    ["00:00:59", { hour: 0, minute: 0, second: 59 }],
  ])("parses %s", (value, parts) => {
    expect(parseTime(value)).toEqual(parts);
  });

  it.each([
    "9:30",
    "09:3",
    "24:00",
    "12:60",
    "12:00:60",
    "09:30 ",
    " 09:30",
    "09:30:",
    "09-30",
    "0930",
    "",
    "ab:cd",
    "09:30:00:00",
    "09:30.5",
  ])("rejects %j", (value) => {
    expect(parseTime(value)).toBeNull();
  });
});

describe("formatTimeValue", () => {
  it("zero-pads by granularity", () => {
    expect(formatTimeValue({ hour: 9, minute: 5, second: 7 }, "minute")).toBe("09:05");
    expect(formatTimeValue({ hour: 9, minute: 5, second: 7 }, "second")).toBe("09:05:07");
    expect(formatTimeValue({ hour: 0, minute: 0, second: 0 }, "second")).toBe("00:00:00");
    expect(formatTimeValue({ hour: 23, minute: 59, second: 59 }, "minute")).toBe("23:59");
  });
});

describe("timeToSeconds / secondsToTimeValue", () => {
  it("counts seconds since midnight", () => {
    expect(timeToSeconds("00:00")).toBe(0);
    expect(timeToSeconds("09:30")).toBe(34200);
    expect(timeToSeconds("23:59:59")).toBe(86399);
    expect(timeToSeconds("24:00")).toBeNull();
    expect(timeToSeconds("9:30")).toBeNull();
  });

  it("round-trips every minute of the day", () => {
    for (let minute = 0; minute < 1440; minute++) {
      const value = secondsToTimeValue(minute * 60, "minute");
      expect(timeToSeconds(value)).toBe(minute * 60);
    }
  });

  it("round-trips seconds at second granularity", () => {
    for (const seconds of [0, 1, 59, 3599, 34230, 86399]) {
      expect(timeToSeconds(secondsToTimeValue(seconds, "second"))).toBe(seconds);
    }
  });

  it("wraps modulo 86400", () => {
    expect(secondsToTimeValue(86400, "minute")).toBe("00:00");
    expect(secondsToTimeValue(86400 + 3600, "minute")).toBe("01:00");
    expect(secondsToTimeValue(-60, "minute")).toBe("23:59");
    expect(secondsToTimeValue(-1, "second")).toBe("23:59:59");
  });

  it("drops seconds at minute granularity", () => {
    expect(secondsToTimeValue(34230, "minute")).toBe("09:30");
  });
});

describe("compareTime", () => {
  it("orders by seconds", () => {
    expect(compareTime("09:00", "10:00")).toBe(-1);
    expect(compareTime("10:00", "09:00")).toBe(1);
    expect(compareTime("10:00", "10:00:00")).toBe(0);
    expect(compareTime("10:00:01", "10:00")).toBe(1);
  });

  it("sorts nulls first without throwing", () => {
    expect(compareTime(null, "00:00")).toBe(-1);
    expect(compareTime("00:00", null)).toBe(1);
    expect(compareTime(null, null)).toBe(0);
    expect(["12:00", null, "08:00"].sort(compareTime)).toEqual([null, "08:00", "12:00"]);
  });
});

describe("resolveHourCycle", () => {
  it.each([
    ["en-US", undefined, "h12"],
    ["en-GB", undefined, "h23"],
    ["de-DE", undefined, "h23"],
    ["ja-JP", undefined, "h23"],
    ["ja-JP", 12, "h11"],
    ["ko-KR", undefined, "h12"],
    ["en-US", 24, "h23"],
    ["de-DE", 12, "h12"],
  ] as const)("%s with %s → %s", (locale, cycle, expected) => {
    expect(resolveHourCycle(locale, cycle)).toBe(expected);
  });
});

describe("formatTime", () => {
  it("formats en-US in 12-hour time", () => {
    expect(formatTime("09:30", "en-US")).toBe(intlTime("en-US", [9, 30, 0], { hourCycle: "h12" }));
    expect(formatTime("21:30", "en-US")).toBe(intlTime("en-US", [21, 30, 0], { hourCycle: "h12" }));
    expect(formatTime("09:30", "en-US")).toMatch(/^9:30\sAM$/u);
  });

  it("formats de-DE in 24-hour time", () => {
    expect(formatTime("21:30", "de-DE")).toBe(intlTime("de-DE", [21, 30, 0], { hourCycle: "h23" }));
    expect(formatTime("21:30", "de-DE")).toBe("21:30");
  });

  it("formats ja-JP with a 12-hour cycle as h11", () => {
    expect(formatTime("12:15", "ja-JP", { hourCycle: 12 })).toBe(
      intlTime("ja-JP", [12, 15, 0], { hourCycle: "h11" }),
    );
  });

  it("formats en-US with hourCycle 24", () => {
    expect(formatTime("21:30", "en-US", { hourCycle: 24 })).toBe(
      intlTime("en-US", [21, 30, 0], { hourCycle: "h23" }),
    );
  });

  it("adds the seconds at second granularity", () => {
    expect(formatTime("21:45:30", "en-US", { granularity: "second" })).toBe(
      intlTime("en-US", [21, 45, 30], { hourCycle: "h12", second: "2-digit" }),
    );
    expect(formatTime("21:45:30", "en-US")).toBe(
      intlTime("en-US", [21, 45, 0], { hourCycle: "h12" }),
    );
  });

  it("returns an empty string for an unparsable value", () => {
    expect(formatTime("25:00", "en-US")).toBe("");
  });

  it("formats in UTC, so the machine's zone and DST never shift it", async () => {
    const expected = intlTime("en-US", [2, 30, 0], { hourCycle: "h12" });
    for (const timezoneId of [
      "America/New_York",
      "Europe/Berlin",
      "Asia/Tokyo",
      "Pacific/Chatham",
    ]) {
      await cdp().send("Emulation.setTimezoneOverride", { timezoneId });
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(timezoneId);
      expect(formatTime("02:30", "en-US")).toBe(expected);
    }
  });
});

describe("timeStepMismatch", () => {
  it("counts from midnight without min", () => {
    expect(timeStepMismatch("09:30", { step: 900 })).toBe(false);
    expect(timeStepMismatch("09:35", { step: 900 })).toBe(true);
    expect(timeStepMismatch("09:35", {})).toBe(false);
    expect(timeStepMismatch("09:35:10", {})).toBe(true);
  });

  it("counts from min", () => {
    expect(timeStepMismatch("09:25", { step: 900, min: "09:10" })).toBe(false);
    expect(timeStepMismatch("09:15", { step: 900, min: "09:10" })).toBe(true);
    expect(timeStepMismatch("01:30", { step: 5400 })).toBe(false);
    expect(timeStepMismatch("02:30", { step: 5400 })).toBe(true);
  });

  it("counts below min the same way", () => {
    expect(timeStepMismatch("08:55", { step: 900, min: "09:10" })).toBe(false);
    expect(timeStepMismatch("09:00", { step: 900, min: "09:10" })).toBe(true);
  });
});

describe("getTimeSlots", () => {
  it("lists 30-minute slots 08:00–10:00 inclusive", () => {
    expect(getTimeSlots({ slotStep: 30, min: "08:00", max: "10:00" })).toEqual([
      "08:00",
      "08:30",
      "09:00",
      "09:30",
      "10:00",
    ]);
  });

  it("drops the slots that mismatch step", () => {
    expect(getTimeSlots({ slotStep: 30, min: "08:00", max: "10:00", step: 3600 })).toEqual([
      "08:00",
      "09:00",
      "10:00",
    ]);
  });

  it("includes max only when it falls on the grid", () => {
    expect(getTimeSlots({ slotStep: 30, min: "08:00", max: "09:45" })).toEqual([
      "08:00",
      "08:30",
      "09:00",
      "09:30",
    ]);
  });

  it("covers the whole day by default", () => {
    const slots = getTimeSlots({ slotStep: 30 });
    expect(slots).toHaveLength(48);
    expect(slots[0]).toBe("00:00");
    expect(slots[47]).toBe("23:30");
  });

  it("formats seconds at second granularity", () => {
    expect(
      getTimeSlots({ slotStep: 15, min: "10:00", max: "10:30", granularity: "second" }),
    ).toEqual(["10:00:00", "10:15:00", "10:30:00"]);
  });

  it.each([0, -15, Number.NaN, Number.POSITIVE_INFINITY])(
    "returns [] and warns for slotStep %s",
    (slotStep) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(getTimeSlots({ slotStep })).toEqual([]);
      expect(warn).toHaveBeenCalledOnce();
    },
  );
});
