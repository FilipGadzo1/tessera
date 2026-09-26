import axe from "axe-core";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, systemColor } from "../../../test/emulation";
import { Calendar, type DateRange, RangeCalendar } from "./calendar";

/*
 * "Today" is frozen: `vi.useFakeTimers({ toFake: ["Date"] })` + `vi.setSystemTime` fakes `Date` in
 * the browser page (verified in Vitest 5 browser mode); only `Date` is faked, so React's
 * scheduler and userEvent keep their real timers.
 */
const TODAY = new Date(2026, 8, 25, 12); // Friday, September 25, 2026

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

const fullDate = (date: Date, locale = "en-US") =>
  new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(date);

const dayButton = (date: Date, locale = "en-US") =>
  page.getByRole("button", { name: fullDate(date, locale), exact: true });

const dayElement = (date: Date, locale = "en-US") =>
  dayButton(date, locale).element() as HTMLButtonElement;

const cellOf = (date: Date, locale = "en-US") =>
  dayElement(date, locale).closest("td") as HTMLTableCellElement;

const focusedLabel = () => document.activeElement?.getAttribute("aria-label") ?? null;

/** Tab from the page start to the grid: Previous, the month and year buttons, Next, the day. */
async function tabToGrid() {
  for (let i = 0; i < 5; i++) await userEvent.tab();
}

function tabbableDays(container: Element) {
  return [...container.querySelectorAll<HTMLButtonElement>('[data-slot="calendar-day"]')].filter(
    (button) => button.tabIndex === 0,
  );
}

describe("Calendar: structure", () => {
  it("renders a 6×7 role=grid named by its caption, with data-slot on every part", async () => {
    const screen = await render(
      <Calendar locale="en-US" defaultMonth={d(2026, 2, 1)} className="shadow-md" />,
    );
    const grid = screen.getByRole("grid", { name: "February 2026" });
    await expect.element(grid).toBeVisible();
    const root = screen.container.querySelector('[data-slot="calendar"]') as HTMLElement;
    expect(root).toHaveClass("shadow-md");
    expect(root).toHaveClass("p-3");
    for (const slot of [
      "calendar-month",
      "calendar-header",
      "calendar-caption",
      "calendar-month-button",
      "calendar-year-button",
      "calendar-prev",
      "calendar-next",
      "calendar-grid",
      "calendar-weekday",
      "calendar-cell",
      "calendar-day",
    ]) {
      expect(root.querySelector(`[data-slot="${slot}"]`), slot).not.toBeNull();
    }
    // February 2026 fits in 4 weeks but the grid is always 6 rows, so the height never jumps.
    const rows = grid.element().querySelectorAll("tbody tr");
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(row.querySelectorAll('[role="gridcell"]')).toHaveLength(7);
    expect(grid.element().querySelectorAll('th[scope="col"]')).toHaveLength(7);
  });

  it.each([
    ["en-US", undefined, "Sunday"],
    ["de-DE", undefined, "Montag"],
    ["en-US", 1, "Monday"],
    ["de-DE", 0, "Sonntag"],
  ] as const)(
    "locale %s with weekStartsOn %s starts the week on %s",
    async (locale, weekStartsOn, first) => {
      const screen = await render(
        <Calendar locale={locale} weekStartsOn={weekStartsOn} defaultMonth={d(2026, 9, 1)} />,
      );
      const headers = screen.container.querySelectorAll('th[scope="col"]');
      expect(headers[0]?.getAttribute("abbr")).toBe(first);
      expect(headers[0]?.textContent?.length).toBeGreaterThan(0);
    },
  );

  it("formats the caption, weekday names and day labels with the locale", async () => {
    const screen = await render(<Calendar locale="de-DE" defaultMonth={d(2026, 9, 1)} />);
    await expect.element(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();
    await expect.element(dayButton(d(2026, 9, 15), "de-DE")).toBeVisible();
    expect(fullDate(d(2026, 9, 15), "de-DE")).toBe("Dienstag, 15. September 2026");
  });

  it("defaults the locale to the document's lang", async () => {
    document.documentElement.lang = "de-DE";
    try {
      const screen = await render(<Calendar defaultMonth={d(2026, 9, 1)} />);
      await expect.element(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();
      await expect.element(dayButton(d(2026, 9, 15), "de-DE")).toBeVisible();
    } finally {
      document.documentElement.lang = "";
    }
  });

  it("marks today with aria-current=date and data-today, and shows today's month by default", async () => {
    const screen = await render(<Calendar locale="en-US" />);
    await expect.element(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();
    const today = dayButton(d(2026, 9, 25));
    await expect.element(today).toHaveAttribute("aria-current", "date");
    await expect.element(today).toHaveAttribute("data-today");
    expect(dayElement(d(2026, 9, 24)).hasAttribute("aria-current")).toBe(false);
  });

  it("shows the value's month by default", async () => {
    const screen = await render(<Calendar locale="en-US" defaultValue={d(2025, 3, 10)} />);
    await expect.element(screen.getByRole("grid", { name: "March 2025" })).toBeVisible();
  });

  it("shows outside days (data-outside) by default", async () => {
    await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
    await expect.element(dayButton(d(2026, 8, 31))).toHaveAttribute("data-outside");
  });

  it("hides outside days with showOutsideDays={false} (empty cells keep the 6×7 grid)", async () => {
    const hidden = await render(
      <Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} showOutsideDays={false} />,
    );
    const buttons = hidden.container.querySelectorAll('[data-slot="calendar-day"]');
    expect(buttons).toHaveLength(30);
    expect(hidden.container.querySelectorAll('[role="gridcell"]')).toHaveLength(42);
  });
});

describe("Calendar: selection", () => {
  it("selects a day on click (aria-selected on the gridcell) and reports it", async () => {
    const onValueChange = vi.fn();
    await render(
      <Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} onValueChange={onValueChange} />,
    );
    await dayButton(d(2026, 9, 15)).click();
    expect(cellOf(d(2026, 9, 15)).getAttribute("aria-selected")).toBe("true");
    expect(dayElement(d(2026, 9, 15))).toHaveAttribute("data-selected");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    const selected = onValueChange.mock.calls[0]?.[0] as Date;
    expect(selected.getTime()).toBe(d(2026, 9, 15).getTime());
    await dayButton(d(2026, 9, 16)).click();
    expect(cellOf(d(2026, 9, 15)).hasAttribute("aria-selected")).toBe(false);
    expect(cellOf(d(2026, 9, 16)).getAttribute("aria-selected")).toBe("true");
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("selects the focused day with %s", async (_, key) => {
    const onValueChange = vi.fn();
    await render(
      <Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} onValueChange={onValueChange} />,
    );
    dayElement(d(2026, 9, 10)).focus();
    await userEvent.keyboard(key);
    expect(cellOf(d(2026, 9, 10)).getAttribute("aria-selected")).toBe("true");
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("is controllable through value / onValueChange", async () => {
    function Controlled() {
      const [value, setValue] = useState<Date | null>(d(2026, 9, 3));
      return (
        <>
          <Calendar locale="en-US" value={value} onValueChange={setValue} />
          <output>{value ? value.toDateString() : "none"}</output>
        </>
      );
    }
    const screen = await render(<Controlled />);
    expect(cellOf(d(2026, 9, 3)).getAttribute("aria-selected")).toBe("true");
    await dayButton(d(2026, 9, 20)).click();
    await expect.element(screen.getByRole("status")).toHaveTextContent("Sun Sep 20 2026");
    expect(cellOf(d(2026, 9, 20)).getAttribute("aria-selected")).toBe("true");
  });

  it("selects an outside day and moves to its month", async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} onValueChange={onValueChange} />,
    );
    await dayButton(d(2026, 10, 2)).click();
    await expect.element(screen.getByRole("grid", { name: "October 2026" })).toBeVisible();
    expect(cellOf(d(2026, 10, 2)).getAttribute("aria-selected")).toBe("true");
    expect(dayElement(d(2026, 10, 2)).hasAttribute("data-outside")).toBe(false);
    expect(focusedLabel()).toBe(fullDate(d(2026, 10, 2)));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });
});

describe("Calendar: keyboard (APG date grid)", () => {
  it.each([
    // [start day, key, expected focused day, expected caption]
    [d(2026, 9, 15), "{ArrowRight}", d(2026, 9, 16), "September 2026"],
    [d(2026, 9, 15), "{ArrowLeft}", d(2026, 9, 14), "September 2026"],
    [d(2026, 9, 15), "{ArrowDown}", d(2026, 9, 22), "September 2026"],
    [d(2026, 9, 15), "{ArrowUp}", d(2026, 9, 8), "September 2026"],
    [d(2026, 9, 15), "{Home}", d(2026, 9, 13), "September 2026"],
    [d(2026, 9, 15), "{End}", d(2026, 9, 19), "September 2026"],
    [d(2026, 9, 15), "{PageDown}", d(2026, 10, 15), "October 2026"],
    [d(2026, 9, 15), "{PageUp}", d(2026, 8, 15), "August 2026"],
    [d(2026, 9, 15), "{Shift>}{PageDown}{/Shift}", d(2027, 9, 15), "September 2027"],
    [d(2026, 9, 15), "{Shift>}{PageUp}{/Shift}", d(2025, 9, 15), "September 2025"],
    // Across a month boundary.
    [d(2026, 9, 30), "{ArrowRight}", d(2026, 10, 1), "October 2026"],
    [d(2026, 9, 1), "{ArrowLeft}", d(2026, 8, 31), "August 2026"],
    [d(2026, 9, 3), "{ArrowUp}", d(2026, 8, 27), "August 2026"],
    [d(2026, 9, 28), "{ArrowDown}", d(2026, 10, 5), "October 2026"],
    [d(2026, 10, 1), "{Home}", d(2026, 9, 27), "September 2026"],
    [d(2026, 9, 30), "{End}", d(2026, 10, 3), "October 2026"],
    [d(2026, 1, 31), "{PageDown}", d(2026, 2, 28), "February 2026"],
    [d(2024, 2, 29), "{Shift>}{PageUp}{/Shift}", d(2023, 2, 28), "February 2023"],
    [d(2024, 2, 29), "{Shift>}{PageDown}{/Shift}", d(2025, 2, 28), "February 2025"],
  ])("from %s, %s focuses %s (%s)", async (start, key, expected, caption) => {
    const screen = await render(<Calendar locale="en-US" defaultMonth={start} />);
    dayElement(start).focus();
    await userEvent.keyboard(key);
    await expect.element(screen.getByRole("grid", { name: caption })).toBeVisible();
    expect(focusedLabel()).toBe(fullDate(expected));
    expect(tabbableDays(screen.container)).toEqual([document.activeElement]);
  });

  it("flips ArrowLeft / ArrowRight in a right-to-left context", async () => {
    await render(
      <div dir="rtl">
        <Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />
      </div>,
    );
    dayElement(d(2026, 9, 15)).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedLabel()).toBe(fullDate(d(2026, 9, 14)));
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(focusedLabel()).toBe(fullDate(d(2026, 9, 16)));
  });

  it.each([
    ["Alt+ArrowRight", "{Alt>}{ArrowRight}{/Alt}"],
    ["Control+Home", "{Control>}{Home}{/Control}"],
    ["Meta+ArrowDown", "{Meta>}{ArrowDown}{/Meta}"],
  ])("leaves %s to the browser (focus stays, not default-prevented)", async (_, key) => {
    const screen = await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
    const prevented: boolean[] = [];
    const record = (event: KeyboardEvent) => {
      if (event.key !== "Alt" && event.key !== "Control" && event.key !== "Meta") {
        prevented.push(event.defaultPrevented);
      }
    };
    // Bubble phase on window: runs after React's root listener, so it sees the handler's verdict.
    window.addEventListener("keydown", record);
    try {
      dayElement(d(2026, 9, 15)).focus();
      await userEvent.keyboard(key);
    } finally {
      window.removeEventListener("keydown", record);
    }
    expect(prevented).toEqual([false]);
    expect(focusedLabel()).toBe(fullDate(d(2026, 9, 15)));
    expect(tabbableDays(screen.container)).toEqual([document.activeElement]);
  });

  it("still moves by a year with Shift+PageDown (Shift is not a browser modifier here)", async () => {
    await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
    dayElement(d(2026, 9, 15)).focus();
    await userEvent.keyboard("{Shift>}{PageDown}{/Shift}");
    expect(focusedLabel()).toBe(fullDate(d(2027, 9, 15)));
  });

  it("uses the locale's week for Home / End (de-DE starts on Monday)", async () => {
    await render(<Calendar locale="de-DE" defaultMonth={d(2026, 9, 1)} />);
    dayElement(d(2026, 9, 15), "de-DE").focus();
    await userEvent.keyboard("{Home}");
    expect(focusedLabel()).toBe(fullDate(d(2026, 9, 14), "de-DE"));
    await userEvent.keyboard("{End}");
    expect(focusedLabel()).toBe(fullDate(d(2026, 9, 20), "de-DE"));
  });

  it("keeps exactly one Tab stop: the selected day", async () => {
    const withValue = await render(<Calendar locale="en-US" defaultValue={d(2026, 9, 3)} />);
    expect(tabbableDays(withValue.container)).toEqual([dayElement(d(2026, 9, 3))]);
  });

  it("keeps exactly one Tab stop: today when nothing is selected", async () => {
    const withToday = await render(<Calendar locale="en-US" />);
    expect(tabbableDays(withToday.container)).toEqual([dayElement(d(2026, 9, 25))]);
  });

  it("keeps exactly one Tab stop: the first enabled day when neither is visible", async () => {
    const firstEnabled = await render(
      <Calendar locale="en-US" defaultMonth={d(2026, 11, 1)} min={d(2026, 11, 4)} />,
    );
    expect(tabbableDays(firstEnabled.container)).toEqual([dayElement(d(2026, 11, 4))]);
    // Tab order: Previous month (aria-disabled but focusable), the month and year buttons, Next
    // month, then the grid.
    await tabToGrid();
    expect(focusedLabel()).toBe(fullDate(d(2026, 11, 4)));
  });

  it("moves the Tab stop with focus", async () => {
    const screen = await render(<Calendar locale="en-US" defaultValue={d(2026, 9, 3)} />);
    await tabToGrid();
    expect(focusedLabel()).toBe(fullDate(d(2026, 9, 3)));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(tabbableDays(screen.container)).toEqual([dayElement(d(2026, 9, 17))]);
  });

  it("focuses the selected day on mount with autoFocus", async () => {
    await render(<Calendar locale="en-US" defaultValue={d(2026, 9, 3)} autoFocus />);
    await expect.poll(focusedLabel).toBe(fullDate(d(2026, 9, 3)));
  });

  it("focuses today on mount with autoFocus when nothing is selected", async () => {
    await render(<Calendar locale="en-US" autoFocus />);
    await expect.poll(focusedLabel).toBe(fullDate(d(2026, 9, 25)));
  });
});

describe("Calendar: min / max / disabled days", () => {
  const min = d(2026, 9, 10);
  const max = d(2026, 10, 20);

  it("disables days outside min/max (aria-disabled, focusable, not selectable)", async () => {
    const onValueChange = vi.fn();
    await render(
      <Calendar
        locale="en-US"
        defaultMonth={d(2026, 9, 1)}
        min={min}
        max={max}
        onValueChange={onValueChange}
      />,
    );
    const before = dayButton(d(2026, 9, 9));
    await expect.element(before).toHaveAttribute("aria-disabled", "true");
    await expect.element(before).toHaveAttribute("data-disabled");
    expect(dayElement(d(2026, 9, 10)).hasAttribute("aria-disabled")).toBe(false);
    // A DOM click: Playwright won't click an aria-disabled element (not "actionable").
    dayElement(d(2026, 9, 9)).click();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(cellOf(d(2026, 9, 9)).hasAttribute("aria-selected")).toBe(false);
    // Enter on a disabled day doesn't select either.
    dayElement(d(2026, 9, 9)).focus();
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(getComputedStyle(dayElement(d(2026, 9, 9))).cursor).toBe("not-allowed");
  });

  it.each([
    [d(2026, 9, 10), "{ArrowLeft}", d(2026, 9, 10)],
    [d(2026, 9, 12), "{ArrowUp}", d(2026, 9, 10)],
    [d(2026, 9, 15), "{PageUp}", d(2026, 9, 10)],
    [d(2026, 9, 15), "{Shift>}{PageUp}{/Shift}", d(2026, 9, 10)],
    [d(2026, 10, 20), "{ArrowRight}", d(2026, 10, 20)],
    [d(2026, 10, 15), "{ArrowDown}", d(2026, 10, 20)],
    [d(2026, 9, 25), "{PageDown}", d(2026, 10, 20)],
  ])("clamps keyboard moves: from %s, %s focuses %s", async (start, key, expected) => {
    await render(<Calendar locale="en-US" defaultMonth={start} min={min} max={max} />);
    dayElement(start).focus();
    await userEvent.keyboard(key);
    expect(focusedLabel()).toBe(fullDate(expected));
  });

  it("disables prev/next at the min/max months", async () => {
    const onMonthChange = vi.fn();
    const screen = await render(
      <Calendar
        locale="en-US"
        defaultMonth={d(2026, 9, 1)}
        min={min}
        max={max}
        onMonthChange={onMonthChange}
      />,
    );
    const prev = screen.getByRole("button", { name: "Previous month" });
    const next = screen.getByRole("button", { name: "Next month" });
    await expect.element(prev).toHaveAttribute("aria-disabled", "true");
    await expect.element(next).not.toHaveAttribute("aria-disabled");
    // A DOM click: Playwright won't click an aria-disabled element (not "actionable").
    (prev.element() as HTMLElement).click();
    expect(onMonthChange).not.toHaveBeenCalled();
    await expect.element(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();
    await next.click();
    await expect.element(screen.getByRole("grid", { name: "October 2026" })).toBeVisible();
    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(onMonthChange).toHaveBeenCalledWith(d(2026, 10, 1));
    await expect.element(next).toHaveAttribute("aria-disabled", "true");
    await expect.element(prev).not.toHaveAttribute("aria-disabled");
    // Disabled but still focused (no focus loss when the button disables under the pointer).
    expect(document.activeElement).toBe(next.element());
  });

  it("disables days via isDateDisabled; they stay reachable with the keyboard", async () => {
    const onValueChange = vi.fn();
    const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;
    await render(
      <Calendar
        locale="en-US"
        defaultMonth={d(2026, 9, 1)}
        isDateDisabled={isWeekend}
        onValueChange={onValueChange}
      />,
    );
    await expect.element(dayButton(d(2026, 9, 19))).toHaveAttribute("aria-disabled", "true");
    await expect.element(dayButton(d(2026, 9, 18))).not.toHaveAttribute("aria-disabled");
    dayElement(d(2026, 9, 18)).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedLabel()).toBe(fullDate(d(2026, 9, 19)));
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("Calendar: month navigation", () => {
  it("has a polite live caption that updates when the month changes", async () => {
    const screen = await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
    const caption = screen.container.querySelector('[data-slot="calendar-caption"]') as HTMLElement;
    expect(caption.getAttribute("aria-live")).toBe("polite");
    expect(caption).toHaveTextContent("September 2026");
    await screen.getByRole("button", { name: "Next month" }).click();
    expect(caption).toHaveTextContent("October 2026");
    await expect.element(screen.getByRole("grid", { name: "October 2026" })).toBeVisible();
    await screen.getByRole("button", { name: "Previous month" }).click();
    await screen.getByRole("button", { name: "Previous month" }).click();
    expect(caption).toHaveTextContent("August 2026");
  });

  it("is controllable through month / onMonthChange", async () => {
    function Controlled() {
      const [month, setMonth] = useState(d(2026, 1, 1));
      return <Calendar locale="en-US" month={month} onMonthChange={setMonth} />;
    }
    const screen = await render(<Controlled />);
    await screen.getByRole("button", { name: "Previous month" }).click();
    await expect.element(screen.getByRole("grid", { name: "December 2025" })).toBeVisible();
    dayElement(d(2025, 12, 31)).focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(screen.getByRole("grid", { name: "January 2026" })).toBeVisible();
    expect(focusedLabel()).toBe(fullDate(d(2026, 1, 1)));
  });

  it("takes translated labels for the prev/next buttons", async () => {
    const screen = await render(
      <Calendar
        locale="de-DE"
        labels={{ previousMonth: "Vorheriger Monat", nextMonth: "Nächster Monat" }}
      />,
    );
    await expect.element(screen.getByRole("button", { name: "Vorheriger Monat" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Nächster Monat" })).toBeVisible();
  });
});

describe("Calendar: focus, cursor and forced colors", () => {
  it("has cursor-pointer and a 2px solid focus ring on keyboard focus", async () => {
    await render(<Calendar locale="en-US" defaultValue={d(2026, 9, 3)} />);
    const day = dayElement(d(2026, 9, 3));
    expect(getComputedStyle(day).cursor).toBe("pointer");
    expect(getComputedStyle(day).outlineStyle).toBe("none");
    await tabToGrid();
    expect(document.activeElement).toBe(day);
    expect(getComputedStyle(day).outlineStyle).toBe("solid");
    expect(getComputedStyle(day).outlineWidth).toBe("2px");
  });

  it("uses the primary colours for the selected day", async () => {
    await render(<Calendar locale="en-US" defaultValue={d(2026, 9, 3)} />);
    const selected = getComputedStyle(dayElement(d(2026, 9, 3))).backgroundColor;
    const other = getComputedStyle(dayElement(d(2026, 9, 4))).backgroundColor;
    expect(selected).not.toBe(other);
    expect(selected).not.toBe("rgba(0, 0, 0, 0)");
  });

  it("shows today's marker as a 2px bar under the number", async () => {
    await render(<Calendar locale="en-US" />);
    const after = getComputedStyle(dayElement(d(2026, 9, 25)), "::after");
    expect(after.borderTopWidth).toBe("2px");
    expect(after.borderTopStyle).toBe("solid");
    expect(getComputedStyle(dayElement(d(2026, 9, 24)), "::after").borderTopWidth).toBe("0px");
  });

  /*
   * *Amended (Task 6 fix round 1, see design-system-v2 spec §4)*: Chromium paints a Canvas-coloured
   * text backplate behind text under forced colors whenever `forced-color-adjust` is `auto` (the
   * default), even when the text's colour is already the explicit system colour `HighlightText` —
   * the backplate sits on top of the `Highlight` fill and hides the glyph. `getComputedStyle`'s
   * `background-color`/`color` checks below cannot detect this (it is a paint-time effect, not a
   * CSS property change), so `forced-color-adjust` itself is checked too.
   */
  it("in forced colors: selected day is Highlight (also on hover), today's bar survives, focus is visible", async () => {
    await emulateForcedColors(true);
    await render(<Calendar locale="en-US" defaultValue={d(2026, 9, 3)} />);
    const selected = dayElement(d(2026, 9, 3));
    const today = dayElement(d(2026, 9, 25));
    expect(getComputedStyle(selected).backgroundColor).toBe(systemColor("Highlight"));
    expect(getComputedStyle(selected).color).toBe(systemColor("HighlightText"));
    expect(getComputedStyle(selected).forcedColorAdjust).toBe("none");
    expect(getComputedStyle(today).forcedColorAdjust).toBe("auto");
    await userEvent.hover(selected);
    expect(getComputedStyle(selected).backgroundColor).toBe(systemColor("Highlight"));
    const bar = getComputedStyle(today, "::after");
    expect(bar.borderTopStyle).toBe("solid");
    expect(bar.borderTopColor).toBe(getComputedStyle(today).color);
    expect(bar.borderTopColor).not.toBe(getComputedStyle(today).backgroundColor);
    // No outline at rest; a solid Highlight ring on keyboard focus.
    expect(getComputedStyle(selected).outlineStyle).toBe("none");
    await tabToGrid();
    expect(document.activeElement).toBe(selected);
    expect(getComputedStyle(selected).outlineStyle).toBe("solid");
    expect(getComputedStyle(selected).outlineColor).toBe(systemColor("Highlight"));
  });

  it("in forced colors: the prev/next buttons have no outline until focused", async () => {
    await emulateForcedColors(true);
    const screen = await render(<Calendar locale="en-US" />);
    const prev = screen.getByRole("button", { name: "Previous month" }).element();
    expect(getComputedStyle(prev).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(prev);
    expect(getComputedStyle(prev).outlineStyle).toBe("solid");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Calendar
          locale="en-US"
          defaultValue={d(2026, 9, 3)}
          min={d(2026, 9, 2)}
          isDateDisabled={(date) => date.getDate() === 12}
        />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.help} ${v.nodes.map((n) => n.html + n.failureSummary).join(" | ")}`,
      ),
    ).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

describe("RangeCalendar", () => {
  it("sets start then end with two clicks, marking start, middle and end", async () => {
    const onValueChange = vi.fn();
    await render(
      <RangeCalendar locale="en-US" defaultMonth={d(2026, 9, 1)} onValueChange={onValueChange} />,
    );
    await dayButton(d(2026, 9, 10)).click();
    expect(onValueChange).toHaveBeenLastCalledWith({ start: d(2026, 9, 10), end: null });
    expect(cellOf(d(2026, 9, 10)).getAttribute("aria-selected")).toBe("true");
    await dayButton(d(2026, 9, 14)).click();
    expect(onValueChange).toHaveBeenLastCalledWith({ start: d(2026, 9, 10), end: d(2026, 9, 14) });
    expect(dayElement(d(2026, 9, 10))).toHaveAttribute("data-range-start");
    expect(dayElement(d(2026, 9, 14))).toHaveAttribute("data-range-end");
    for (const day of [11, 12, 13]) {
      expect(dayElement(d(2026, 9, day))).toHaveAttribute("data-range-middle");
      expect(cellOf(d(2026, 9, day)).getAttribute("aria-selected")).toBe("true");
    }
    expect(cellOf(d(2026, 9, 15)).hasAttribute("aria-selected")).toBe(false);
  });

  it("swaps a second date earlier than the start", async () => {
    const onValueChange = vi.fn();
    await render(
      <RangeCalendar locale="en-US" defaultMonth={d(2026, 9, 1)} onValueChange={onValueChange} />,
    );
    await dayButton(d(2026, 9, 20)).click();
    await dayButton(d(2026, 9, 5)).click();
    expect(onValueChange).toHaveBeenLastCalledWith({ start: d(2026, 9, 5), end: d(2026, 9, 20) });
    expect(dayElement(d(2026, 9, 5))).toHaveAttribute("data-range-start");
    expect(dayElement(d(2026, 9, 20))).toHaveAttribute("data-range-end");
  });

  it("starts over on a third click", async () => {
    const onValueChange = vi.fn();
    await render(
      <RangeCalendar
        locale="en-US"
        defaultValue={{ start: d(2026, 9, 5), end: d(2026, 9, 8) }}
        onValueChange={onValueChange}
      />,
    );
    await dayButton(d(2026, 9, 22)).click();
    expect(onValueChange).toHaveBeenLastCalledWith({ start: d(2026, 9, 22), end: null });
    expect(dayElement(d(2026, 9, 6)).hasAttribute("data-range-middle")).toBe(false);
    expect(cellOf(d(2026, 9, 5)).hasAttribute("aria-selected")).toBe(false);
  });

  it("previews the range on hover and on keyboard focus while only the start is set", async () => {
    await render(<RangeCalendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
    await dayButton(d(2026, 9, 10)).click();
    await userEvent.hover(dayElement(d(2026, 9, 13)));
    for (const day of [11, 12, 13]) {
      expect(dayElement(d(2026, 9, day))).toHaveAttribute("data-range-preview");
    }
    expect(dayElement(d(2026, 9, 14)).hasAttribute("data-range-preview")).toBe(false);
    expect(cellOf(d(2026, 9, 12)).hasAttribute("aria-selected")).toBe(false);

    // Keyboard: the focused day drives the preview (earlier than the start works too).
    await userEvent.unhover(dayElement(d(2026, 9, 13)));
    dayElement(d(2026, 9, 10)).focus();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(dayElement(d(2026, 9, 8))).toHaveAttribute("data-range-preview");
    expect(dayElement(d(2026, 9, 9))).toHaveAttribute("data-range-preview");
    expect(dayElement(d(2026, 9, 12)).hasAttribute("data-range-preview")).toBe(false);
  });

  it("draws a continuous band: inner corners of the ends and the middle are square", async () => {
    await render(
      <RangeCalendar locale="en-US" defaultValue={{ start: d(2026, 9, 9), end: d(2026, 9, 11) }} />,
    );
    const start = getComputedStyle(dayElement(d(2026, 9, 9)));
    const middle = getComputedStyle(dayElement(d(2026, 9, 10)));
    const end = getComputedStyle(dayElement(d(2026, 9, 11)));
    expect(start.borderTopLeftRadius).not.toBe("0px");
    expect(start.borderTopRightRadius).toBe("0px");
    expect(middle.borderRadius).toBe("0px");
    expect(end.borderTopLeftRadius).toBe("0px");
    expect(end.borderTopRightRadius).not.toBe("0px");
    expect(middle.backgroundColor).not.toBe(start.backgroundColor);
    expect(middle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  });

  it("shows two months side by side with continuous keyboard navigation across them", async () => {
    const screen = await render(
      <RangeCalendar locale="en-US" numberOfMonths={2} defaultMonth={d(2026, 9, 1)} />,
    );
    const september = screen.getByRole("grid", { name: "September 2026" });
    const october = screen.getByRole("grid", { name: "October 2026" });
    await expect.element(september).toBeVisible();
    await expect.element(october).toBeVisible();
    const sepBox = september.element().getBoundingClientRect();
    const octBox = october.element().getBoundingClientRect();
    expect(octBox.left).toBeGreaterThan(sepBox.right);
    expect(Math.abs(octBox.top - sepBox.top)).toBeLessThanOrEqual(1);
    // Each day appears once: the days between the two months aren't repeated as outside days.
    expect(page.getByRole("button", { name: fullDate(d(2026, 10, 1)) }).elements()).toHaveLength(1);
    expect(tabbableDays(screen.container)).toHaveLength(1);
    // Only the first month has "Previous", only the last "Next".
    expect(screen.container.querySelectorAll('[data-slot="calendar-prev"]')).toHaveLength(1);
    expect(screen.container.querySelectorAll('[data-slot="calendar-next"]')).toHaveLength(1);

    dayElement(d(2026, 9, 30)).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedLabel()).toBe(fullDate(d(2026, 10, 1)));
    expect(october.element().contains(document.activeElement)).toBe(true);
    await expect.element(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();

    await userEvent.keyboard("{ArrowLeft}");
    expect(focusedLabel()).toBe(fullDate(d(2026, 9, 30)));

    // Leaving both months shifts the pair.
    dayElement(d(2026, 10, 31)).focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(screen.getByRole("grid", { name: "November 2026" })).toBeVisible();
    await expect.element(screen.getByRole("grid", { name: "October 2026" })).toBeVisible();
    expect(focusedLabel()).toBe(fullDate(d(2026, 11, 1)));

    dayElement(d(2026, 10, 1)).focus();
    await userEvent.keyboard("{PageUp}");
    await expect.element(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();
    await expect.element(screen.getByRole("grid", { name: "October 2026" })).toBeVisible();
    expect(focusedLabel()).toBe(fullDate(d(2026, 9, 1)));
  });

  it("selects a range across the two months", async () => {
    const onValueChange = vi.fn();
    await render(
      <RangeCalendar
        locale="en-US"
        numberOfMonths={2}
        defaultMonth={d(2026, 9, 1)}
        onValueChange={onValueChange}
      />,
    );
    await dayButton(d(2026, 9, 28)).click();
    await dayButton(d(2026, 10, 3)).click();
    expect(onValueChange).toHaveBeenLastCalledWith({ start: d(2026, 9, 28), end: d(2026, 10, 3) });
    expect(dayElement(d(2026, 10, 1))).toHaveAttribute("data-range-middle");
  });

  it("is controllable through value / onValueChange", async () => {
    function Controlled() {
      const [range, setRange] = useState<DateRange>({ start: null, end: null });
      return (
        <>
          <RangeCalendar
            locale="en-US"
            defaultMonth={d(2026, 9, 1)}
            value={range}
            onValueChange={setRange}
          />
          <output>
            {range.start?.getDate() ?? "-"}/{range.end?.getDate() ?? "-"}
          </output>
        </>
      );
    }
    const screen = await render(<Controlled />);
    await dayButton(d(2026, 9, 4)).click();
    await expect.element(screen.getByRole("status")).toHaveTextContent("4/-");
    await dayButton(d(2026, 9, 9)).click();
    await expect.element(screen.getByRole("status")).toHaveTextContent("4/9");
  });

  it("in forced colors: the ends are Highlight and the middle has a visible band border", async () => {
    await emulateForcedColors(true);
    await render(
      <RangeCalendar locale="en-US" defaultValue={{ start: d(2026, 9, 9), end: d(2026, 9, 11) }} />,
    );
    const start = getComputedStyle(dayElement(d(2026, 9, 9)));
    const middle = getComputedStyle(dayElement(d(2026, 9, 10)));
    const plain = getComputedStyle(dayElement(d(2026, 9, 14)));
    expect(start.backgroundColor).toBe(systemColor("Highlight"));
    expect(start.forcedColorAdjust).toBe("none");
    expect(getComputedStyle(dayElement(d(2026, 9, 11))).backgroundColor).toBe(
      systemColor("Highlight"),
    );
    expect(getComputedStyle(dayElement(d(2026, 9, 11))).forcedColorAdjust).toBe("none");
    // The range middle isn't "selected" (it has no HighlightText text colour, only a border), so
    // it keeps the default forced-colors handling.
    expect(middle.forcedColorAdjust).toBe("auto");
    expect(middle.borderTopStyle).toBe("solid");
    expect(middle.borderTopWidth).toBe("1px");
    expect(middle.borderBottomStyle).toBe("solid");
    expect(middle.borderTopColor).toBe(systemColor("CanvasText"));
    expect(plain.borderTopWidth).toBe("0px");
    // Still no outline at rest (the band is a border, not an outline).
    expect(middle.outlineStyle).toBe("none");
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations in the %s theme (two months, preview)",
    async (theme) => {
      // w-max: two months are wider than the test viewport; keep them on the themed background.
      const screen = await render(
        <div
          className={theme === "dark" ? "dark w-max bg-background p-4" : "w-max bg-background p-4"}
        >
          <RangeCalendar
            locale="en-US"
            numberOfMonths={2}
            defaultValue={{ start: d(2026, 9, 9), end: d(2026, 9, 16) }}
          />
        </div>,
      );
      const results = await axe.run(screen.container);
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.help} ${v.nodes.map((n) => n.html + n.failureSummary).join(" | ")}`,
        ),
      ).toEqual([]);
      expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    },
  );
});
