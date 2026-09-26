import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, systemColor } from "../../../test/emulation";
import { Calendar, RangeCalendar } from "./calendar";

/* Month and year views (spec §6.2). "Today" is frozen as in calendar.test.tsx. */
const TODAY = new Date(2026, 8, 25, 12); // Friday, September 25, 2026

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});

afterEach(async () => {
  vi.useRealTimers();
  await emulateForcedColors(false);
});

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const fullDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(date);
const yearRange = (from: number, locale = "en-US") =>
  new Intl.DateTimeFormat(locale, { year: "numeric" }).formatRange(
    new Date(from, 0, 1),
    new Date(from + 11, 0, 1),
  );

const focusedLabel = () =>
  document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? null;
const monthButton = (caption = "September 2026") =>
  page.getByRole("button", { name: `Choose month, ${caption}`, exact: true });
const yearButton = (year = "2026") =>
  page.getByRole("button", { name: `Choose year, ${year}`, exact: true });
/** A month cell's button, named by its month and year ("March 2027"). */
const monthItem = (name: string) => page.getByRole("button", { name, exact: true });
const yearItem = (year: number) => page.getByRole("button", { name: String(year), exact: true });
const cellOf = (element: Element) => element.closest('[role="gridcell"]') as HTMLElement;

function tabbable(container: Element, slot: string) {
  return [...container.querySelectorAll<HTMLButtonElement>(`[data-slot="${slot}"]`)].filter(
    (button) => button.tabIndex === 0,
  );
}

describe("Calendar views: caption buttons", () => {
  it("shows the month and year as buttons, keeps a visually hidden live caption naming the grid", async () => {
    const screen = await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
    await expect.element(monthButton()).toHaveTextContent("September");
    await expect.element(yearButton()).toHaveTextContent("2026");
    const caption = screen.container.querySelector('[data-slot="calendar-caption"]') as HTMLElement;
    expect(caption.getAttribute("aria-live")).toBe("polite");
    expect(caption).toHaveTextContent("September 2026");
    // Visually hidden (sr-only): 1px, clipped.
    expect(caption.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    await expect.element(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();
    // Order: the month button before the year button, between Previous and Next.
    const header = screen.container.querySelector('[data-slot="calendar-header"]') as HTMLElement;
    const slots = [...header.querySelectorAll("button")].map((b) => b.dataset.slot);
    expect(slots).toEqual([
      "calendar-prev",
      "calendar-month-button",
      "calendar-year-button",
      "calendar-next",
    ]);
    // Ghost buttons: no background at rest, h-8 like the nav buttons.
    const month = monthButton().element() as HTMLElement;
    expect(getComputedStyle(month).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(month.getBoundingClientRect().height).toBe(32);
    expect(getComputedStyle(month).fontWeight).toBe("500");
  });

  it("orders the year button first where the locale does (ja-JP)", async () => {
    const screen = await render(<Calendar locale="ja-JP" defaultMonth={d(2026, 9, 1)} />);
    const header = screen.container.querySelector('[data-slot="calendar-header"]') as HTMLElement;
    const slots = [...header.querySelectorAll("button")].map((b) => b.dataset.slot);
    expect(slots.slice(1, 3)).toEqual(["calendar-year-button", "calendar-month-button"]);
    expect(header.querySelector('[data-slot="calendar-year-button"]')).toHaveTextContent("2026年");
    expect(header.querySelector('[data-slot="calendar-month-button"]')).toHaveTextContent("9月");
  });

  it("takes translated labels (functions or string prefixes)", async () => {
    const screen = await render(
      <Calendar
        locale="de-DE"
        defaultMonth={d(2026, 9, 1)}
        labels={{
          chooseMonth: (caption) => `Monat wählen (${caption})`,
          chooseYear: "Jahr wählen",
          previousYear: "Vorheriges Jahr",
          nextYear: "Nächstes Jahr",
          previousYears: "Vorherige 12 Jahre",
          nextYears: "Nächste 12 Jahre",
          monthGrid: (year) => `Monate ${year}`,
          yearGrid: "Jahre",
        }}
      />,
    );
    await expect
      .element(page.getByRole("button", { name: "Monat wählen (September 2026)" }))
      .toBeVisible();
    await page.getByRole("button", { name: "Monat wählen (September 2026)" }).click();
    await expect.element(screen.getByRole("grid", { name: "Monate 2026" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Vorheriges Jahr" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Nächstes Jahr" })).toBeVisible();
    await page.getByRole("button", { name: "Jahr wählen, 2026" }).click();
    await expect
      .element(screen.getByRole("grid", { name: `Jahre, ${yearRange(2016, "de-DE")}` }))
      .toBeVisible();
    await expect.element(page.getByRole("button", { name: "Vorherige 12 Jahre" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Nächste 12 Jahre" })).toBeVisible();
  });
});

describe("Calendar views: month view", () => {
  it("opens by click: a 3-column × 4-row grid of months, the visible month selected, the current month marked, focus on it", async () => {
    const screen = await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
    await monthButton().click();
    const grid = screen.getByRole("grid", { name: "Months, 2026" });
    await expect.element(grid).toBeVisible();
    expect(screen.container.querySelector('[data-slot="calendar-grid"]')).toBeNull();
    const rows = grid.element().querySelectorAll("tbody tr");
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row.querySelectorAll('[role="gridcell"]')).toHaveLength(3);
    const items = grid.element().querySelectorAll('[data-slot="calendar-month-item"]');
    expect([...items].map((b) => b.textContent)).toEqual([
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]);
    const september = monthItem("September 2026").element() as HTMLElement;
    expect(cellOf(september).getAttribute("aria-selected")).toBe("true");
    expect(september.hasAttribute("data-selected")).toBe(true);
    expect(september.getAttribute("aria-current")).toBe("date");
    expect(cellOf(monthItem("October 2026").element()).hasAttribute("aria-selected")).toBe(false);
    expect(document.activeElement).toBe(september);
    expect(tabbable(screen.container, "calendar-month-item")).toEqual([september]);
    // The header: just the year button, with year paging.
    await expect.element(monthButton()).not.toBeInTheDocument();
    await expect.element(yearButton()).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Previous year" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Next year" })).toBeVisible();
    // The selected month uses the primary colours; the today bar marks the current month.
    expect(getComputedStyle(september).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(september, "::after").borderTopWidth).toBe("2px");
    expect(getComputedStyle(september).cursor).toBe("pointer");
  });

  it("opens by keyboard and moves with the arrows, Home/End and PageUp/PageDown", async () => {
    const screen = await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
    (monthButton().element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByRole("grid", { name: "Months, 2026" })).toBeVisible();
    expect(focusedLabel()).toBe("September 2026");
    const steps: [string, string, string][] = [
      ["{ArrowRight}", "October 2026", "Months, 2026"],
      ["{ArrowLeft}", "September 2026", "Months, 2026"],
      ["{ArrowUp}", "June 2026", "Months, 2026"],
      ["{ArrowDown}", "September 2026", "Months, 2026"],
      ["{Home}", "January 2026", "Months, 2026"],
      ["{End}", "December 2026", "Months, 2026"],
      ["{ArrowRight}", "January 2027", "Months, 2027"],
      ["{PageUp}", "January 2026", "Months, 2026"],
      ["{PageDown}", "January 2027", "Months, 2027"],
      ["{ArrowUp}", "October 2026", "Months, 2026"],
    ];
    for (const [key, expected, grid] of steps) {
      await userEvent.keyboard(key);
      expect(focusedLabel(), key).toBe(expected);
      await expect.element(screen.getByRole("grid", { name: grid })).toBeVisible();
      expect(tabbable(screen.container, "calendar-month-item")).toEqual([document.activeElement]);
    }
    // The header year follows the focused page; the selection doesn't move with focus.
    await userEvent.keyboard("{PageDown}");
    await expect.element(yearButton("2027")).toBeVisible();
    expect(screen.container.querySelector('[data-slot="calendar-month-item"][data-selected]')).toBe(
      null,
    );
  });

  it("opens with Space too", async () => {
    const screen = await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
    (monthButton().element() as HTMLElement).focus();
    await userEvent.keyboard(" ");
    await expect.element(screen.getByRole("grid", { name: "Months, 2026" })).toBeVisible();
  });

  it("pages by year with the header buttons (focus stays on the button)", async () => {
    const screen = await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
    await monthButton().click();
    await screen.getByRole("button", { name: "Next year" }).click();
    await expect.element(screen.getByRole("grid", { name: "Months, 2027" })).toBeVisible();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Next year" }).element(),
    );
    expect(tabbable(screen.container, "calendar-month-item")).toEqual([
      monthItem("September 2027").element(),
    ]);
    await screen.getByRole("button", { name: "Previous year" }).click();
    await screen.getByRole("button", { name: "Previous year" }).click();
    await expect.element(screen.getByRole("grid", { name: "Months, 2025" })).toBeVisible();
  });

  it("picks a month: back to the day view, focus on the same day number clamped (Jan 31 → Feb 28), nothing selected", async () => {
    const onValueChange = vi.fn();
    const onMonthChange = vi.fn();
    const screen = await render(
      <Calendar
        locale="en-US"
        defaultValue={d(2026, 1, 31)}
        onValueChange={onValueChange}
        onMonthChange={onMonthChange}
      />,
    );
    await monthButton("January 2026").click();
    await monthItem("February 2026").click();
    await expect.element(screen.getByRole("grid", { name: "February 2026" })).toBeVisible();
    expect(focusedLabel()).toBe(fullDate(d(2026, 2, 28)));
    expect(tabbable(screen.container, "calendar-day")).toEqual([document.activeElement]);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onMonthChange).toHaveBeenCalledWith(d(2026, 2, 1));
    expect(screen.container.querySelector("[data-selected]")).toBeNull();
    // The live caption (the same element) now reads the new month.
    const caption = screen.container.querySelector('[data-slot="calendar-caption"]') as HTMLElement;
    expect(caption).toHaveTextContent("February 2026");
  });

  it("picks a month with Enter", async () => {
    const screen = await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
    await monthButton().click();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{Enter}");
    await expect.element(screen.getByRole("grid", { name: "July 2026" })).toBeVisible();
    // Today (Sep 25) held the Tab stop: day 25 of July.
    expect(focusedLabel()).toBe(fullDate(d(2026, 7, 25)));
  });

  it("flips ArrowLeft / ArrowRight in a right-to-left context", async () => {
    await render(
      <div dir="rtl">
        <Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />
      </div>,
    );
    await monthButton().click();
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedLabel()).toBe("August 2026");
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(focusedLabel()).toBe("October 2026");
  });

  it("Escape returns to the day view with focus on the day that had the Tab stop, and stops the event", async () => {
    const screen = await render(<Calendar locale="en-US" defaultValue={d(2026, 9, 3)} />);
    await monthButton().click();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    const seen: boolean[] = [];
    const record = (event: KeyboardEvent) => {
      if (event.key === "Escape") seen.push(event.defaultPrevented);
    };
    document.addEventListener("keydown", record);
    try {
      await userEvent.keyboard("{Escape}");
    } finally {
      document.removeEventListener("keydown", record);
    }
    // Propagation stopped before the document (where Base UI's dismiss listens).
    expect(seen).toEqual([]);
    await expect.element(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();
    expect(focusedLabel()).toBe(fullDate(d(2026, 9, 3)));
    // In the day view Escape is left alone.
    document.addEventListener("keydown", record);
    try {
      await userEvent.keyboard("{Escape}");
    } finally {
      document.removeEventListener("keydown", record);
    }
    expect(seen).toEqual([false]);
  });

  it("the header year button goes on to the year view", async () => {
    const screen = await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
    await monthButton().click();
    await yearButton().click();
    await expect
      .element(screen.getByRole("grid", { name: `Years, ${yearRange(2016)}` }))
      .toBeVisible();
    expect(focusedLabel()).toBe("2026");
  });
});

describe("Calendar views: year view", () => {
  it("opens by click: 12 years containing the visible year, the range button in the header, focus on the year", async () => {
    const screen = await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
    await yearButton().click();
    const grid = screen.getByRole("grid", { name: `Years, ${yearRange(2016)}` });
    await expect.element(grid).toBeVisible();
    expect(yearRange(2016)).toBe("2016 – 2027");
    const items = grid.element().querySelectorAll('[data-slot="calendar-year-item"]');
    expect([...items].map((b) => b.textContent)).toEqual(
      Array.from({ length: 12 }, (_, i) => String(2016 + i)),
    );
    expect(grid.element().querySelectorAll("tbody tr")).toHaveLength(4);
    const current = yearItem(2026).element() as HTMLElement;
    expect(cellOf(current).getAttribute("aria-selected")).toBe("true");
    expect(current.getAttribute("aria-current")).toBe("date");
    expect(document.activeElement).toBe(current);
    const range = screen.container.querySelector('[data-slot="calendar-year-range"]');
    expect(range).toHaveTextContent("2016 – 2027");
    // A button back to the days (fix round 1).
    expect(range?.tagName).toBe("BUTTON");
    await expect.element(yearButton()).not.toBeInTheDocument();
    await expect.element(monthButton()).not.toBeInTheDocument();
  });

  it("pages by 12 years, picks a year → month view → day", async () => {
    const screen = await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
    await yearButton().click();
    await screen.getByRole("button", { name: "Next 12 years" }).click();
    await expect
      .element(screen.getByRole("grid", { name: `Years, ${yearRange(2028)}` }))
      .toBeVisible();
    await screen.getByRole("button", { name: "Previous 12 years" }).click();
    await screen.getByRole("button", { name: "Previous 12 years" }).click();
    await expect
      .element(screen.getByRole("grid", { name: `Years, ${yearRange(2004)}` }))
      .toBeVisible();
    await yearItem(2010).click();
    await expect.element(screen.getByRole("grid", { name: "Months, 2010" })).toBeVisible();
    expect(focusedLabel()).toBe("September 2010");
    await monthItem("March 2010").click();
    await expect.element(screen.getByRole("grid", { name: "March 2010" })).toBeVisible();
    expect(focusedLabel()).toBe(fullDate(d(2010, 3, 25)));
  });

  it("moves with the arrows, Home/End and PageUp/PageDown, across pages", async () => {
    const screen = await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
    (yearButton().element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    const steps: [string, string, number][] = [
      ["{ArrowRight}", "2027", 2016],
      ["{ArrowRight}", "2028", 2028],
      ["{ArrowLeft}", "2027", 2016],
      ["{ArrowUp}", "2024", 2016],
      ["{ArrowDown}", "2027", 2016],
      ["{Home}", "2016", 2016],
      ["{End}", "2027", 2016],
      ["{PageDown}", "2039", 2028],
      ["{PageUp}", "2027", 2016],
      ["{PageUp}", "2015", 2004],
    ];
    for (const [key, expected, from] of steps) {
      await userEvent.keyboard(key);
      expect(focusedLabel(), key).toBe(expected);
      await expect
        .element(screen.getByRole("grid", { name: `Years, ${yearRange(from)}` }))
        .toBeVisible();
      expect(tabbable(screen.container, "calendar-year-item")).toEqual([document.activeElement]);
    }
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByRole("grid", { name: "Months, 2015" })).toBeVisible();
  });

  it("Escape returns to the day view", async () => {
    const screen = await render(<Calendar locale="en-US" />);
    await yearButton().click();
    await userEvent.keyboard("{ArrowLeft}{Escape}");
    await expect.element(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();
    expect(focusedLabel()).toBe(fullDate(d(2026, 9, 25)));
  });
});

describe("Calendar views: min / max", () => {
  const min = d(2024, 3, 15);
  const max = d(2027, 8, 10);

  it("disables months entirely outside min/max, and year paging past them", async () => {
    const onMonthChange = vi.fn();
    const screen = await render(
      <Calendar
        locale="en-US"
        defaultMonth={d(2027, 5, 1)}
        min={min}
        max={max}
        onMonthChange={onMonthChange}
      />,
    );
    await monthButton("May 2027").click();
    await expect.element(monthItem("August 2027")).not.toHaveAttribute("aria-disabled");
    for (const name of ["September 2027", "December 2027"]) {
      const item = monthItem(name);
      await expect.element(item).toHaveAttribute("aria-disabled", "true");
      await expect.element(item).toHaveAttribute("data-disabled");
    }
    expect(getComputedStyle(monthItem("December 2027").element()).cursor).toBe("not-allowed");
    const next = screen.getByRole("button", { name: "Next year" });
    await expect.element(next).toHaveAttribute("aria-disabled", "true");
    (next.element() as HTMLElement).click();
    await expect.element(screen.getByRole("grid", { name: "Months, 2027" })).toBeVisible();
    // A disabled month can't be chosen (DOM click: Playwright won't click aria-disabled).
    (monthItem("October 2027").element() as HTMLElement).click();
    await expect.element(screen.getByRole("grid", { name: "Months, 2027" })).toBeVisible();
    expect(onMonthChange).not.toHaveBeenCalled();
    // Keys stop at the last enabled month.
    (monthItem("August 2027").element() as HTMLElement).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedLabel()).toBe("August 2027");
    await userEvent.keyboard("{PageDown}");
    expect(focusedLabel()).toBe("August 2027");
    // Back through the years to min: March 2024 is enabled (partly inside), February isn't.
    await screen.getByRole("button", { name: "Previous year" }).click();
    await screen.getByRole("button", { name: "Previous year" }).click();
    await screen.getByRole("button", { name: "Previous year" }).click();
    await expect.element(screen.getByRole("grid", { name: "Months, 2024" })).toBeVisible();
    await expect.element(monthItem("March 2024")).not.toHaveAttribute("aria-disabled");
    await expect.element(monthItem("February 2024")).toHaveAttribute("aria-disabled", "true");
    await expect
      .element(screen.getByRole("button", { name: "Previous year" }))
      .toHaveAttribute("aria-disabled", "true");
    // Picking March 2024 focuses day 1 clamped to min (the 15th).
    await monthItem("March 2024").click();
    await expect.element(screen.getByRole("grid", { name: "March 2024" })).toBeVisible();
    expect(focusedLabel()).toBe(fullDate(d(2024, 3, 15)));
  });

  it("disables years entirely outside min/max; the year page can't move past them", async () => {
    const screen = await render(
      <Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} min={min} max={max} />,
    );
    await yearButton().click();
    for (const year of [2016, 2023]) {
      await expect.element(yearItem(year)).toHaveAttribute("aria-disabled", "true");
    }
    for (const year of [2024, 2027]) {
      await expect.element(yearItem(year)).not.toHaveAttribute("aria-disabled");
    }
    for (const name of ["Previous 12 years", "Next 12 years"]) {
      await expect
        .element(screen.getByRole("button", { name }))
        .toHaveAttribute("aria-disabled", "true");
    }
    (yearItem(2020).element() as HTMLElement).click();
    await expect
      .element(screen.getByRole("grid", { name: `Years, ${yearRange(2016)}` }))
      .toBeVisible();
    (yearItem(2024).element() as HTMLElement).focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(focusedLabel()).toBe("2024");
    await userEvent.keyboard("{Home}");
    expect(focusedLabel()).toBe("2024");
    await userEvent.keyboard("{End}");
    expect(focusedLabel()).toBe("2027");
    // Picking 2027 opens its months with focus clamped into range (September → August).
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByRole("grid", { name: "Months, 2027" })).toBeVisible();
    expect(focusedLabel()).toBe("August 2027");
  });
});

describe("Calendar views: RangeCalendar with two months", () => {
  it("each pane has its own caption buttons; the right pane choosing October 2027 shows September–October 2027", async () => {
    const onMonthChange = vi.fn();
    const screen = await render(
      <RangeCalendar
        locale="en-US"
        numberOfMonths={2}
        defaultMonth={d(2026, 9, 1)}
        onMonthChange={onMonthChange}
      />,
    );
    await expect.element(monthButton("September 2026")).toBeVisible();
    await expect.element(monthButton("October 2026")).toBeVisible();
    await yearButton().first().click();
    // The left pane shows years; the right pane keeps its days.
    await expect
      .element(screen.getByRole("grid", { name: `Years, ${yearRange(2016)}` }))
      .toBeVisible();
    await expect.element(screen.getByRole("grid", { name: "October 2026" })).toBeVisible();
    // Opening the right pane's view closes the left one's: one non-day view at a time.
    await monthButton("October 2026").click();
    await expect.element(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();
    await expect.element(screen.getByRole("grid", { name: "Months, 2026" })).toBeVisible();
    expect(screen.container.querySelectorAll('[role="grid"]')).toHaveLength(2);
    await screen.getByRole("button", { name: "Next year" }).click();
    await monthItem("October 2027").click();
    await expect.element(screen.getByRole("grid", { name: "September 2027" })).toBeVisible();
    await expect.element(screen.getByRole("grid", { name: "October 2027" })).toBeVisible();
    expect(onMonthChange).toHaveBeenLastCalledWith(d(2027, 9, 1));
    // Today (Sep 25) held the Tab stop: day 25 of the chosen month.
    expect(focusedLabel()).toBe(fullDate(d(2027, 10, 25)));
  });

  it("keeps the two-month footprint in a pane's month view", async () => {
    const screen = await render(
      <div className="w-max">
        <RangeCalendar locale="en-US" numberOfMonths={2} defaultMonth={d(2026, 9, 1)} />
      </div>,
    );
    const root = screen.container.querySelector('[data-slot="calendar"]') as HTMLElement;
    const before = root.getBoundingClientRect();
    await monthButton("October 2026").click();
    const after = root.getBoundingClientRect();
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
  });
});

describe("Calendar views: footprint, forced colors and axe", () => {
  it("keeps the calendar's size between the day, month and year views (±1px)", async () => {
    const screen = await render(<Calendar locale="en-US" defaultMonth={d(2026, 2, 1)} />);
    const root = screen.container.querySelector('[data-slot="calendar"]') as HTMLElement;
    const day = root.getBoundingClientRect();
    await monthButton("February 2026").click();
    const month = root.getBoundingClientRect();
    await yearButton().click();
    const year = root.getBoundingClientRect();
    for (const box of [month, year]) {
      expect(Math.abs(box.width - day.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.height - day.height)).toBeLessThanOrEqual(1);
    }
    const header = root.querySelector('[data-slot="calendar-header"]') as HTMLElement;
    expect(header.getBoundingClientRect().height).toBe(32);
  });

  it.each(["month", "year"] as const)(
    "the %s cells are wide chips filling the grid evenly (3 columns × 4 rows)",
    async (view) => {
      const screen = await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
      await (view === "month" ? monthButton() : yearButton()).click();
      const grid = screen.getByRole("grid").element() as HTMLElement;
      const items = [...grid.querySelectorAll("button")];
      const box = (i: number) => items[i]?.getBoundingClientRect() as DOMRect;
      const g = grid.getBoundingClientRect();
      // Wide chips (3 columns × 4 rows, fix round 2): taller than a day (36px) and wider than
      // tall, and the four rows span the grid with small, even gaps.
      expect(box(0).height).toBeGreaterThanOrEqual(52);
      expect(box(0).width).toBeGreaterThan(box(0).height);
      expect(box(0).width).toBeGreaterThanOrEqual(72);
      expect(box(0).top - g.top).toBeLessThanOrEqual(12);
      expect(g.bottom - box(11).bottom).toBeLessThanOrEqual(12);
      const rowGap = box(3).top - box(0).bottom;
      const columnGap = box(1).left - box(0).right;
      expect(Math.abs(rowGap - columnGap)).toBeLessThanOrEqual(8);
    },
  );

  it.each(["month", "year"] as const)(
    "in forced colors: the selected %s is Highlight with HighlightText (no backplate), focus is visible",
    async (view) => {
      await emulateForcedColors(true);
      await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
      await (view === "month" ? monthButton() : yearButton()).click();
      const selected = (
        view === "month" ? monthItem("September 2026") : yearItem(2026)
      ).element() as HTMLElement;
      const other = (view === "month" ? monthItem("March 2026") : yearItem(2020)).element();
      expect(getComputedStyle(selected).backgroundColor).toBe(systemColor("Highlight"));
      expect(getComputedStyle(selected).color).toBe(systemColor("HighlightText"));
      expect(getComputedStyle(selected).forcedColorAdjust).toBe("none");
      expect(getComputedStyle(other).forcedColorAdjust).toBe("auto");
      expect(getComputedStyle(other).outlineStyle).toBe("none");
      // Opened by click, the focused cell was focused programmatically: move with a key to show
      // the keyboard ring.
      await userEvent.keyboard("{ArrowRight}{ArrowLeft}");
      expect(document.activeElement).toBe(selected);
      expect(getComputedStyle(selected).outlineStyle).toBe("solid");
      expect(getComputedStyle(selected).outlineWidth).toBe("2px");
      expect(getComputedStyle(selected).outlineColor).toBe(systemColor("Highlight"));
      // The header's caption button (year button / range button): no outline until focused.
      const caption = document.querySelector(
        view === "month"
          ? '[data-slot="calendar-year-button"]'
          : '[data-slot="calendar-year-range"]',
      ) as HTMLElement;
      expect(caption.tagName).toBe("BUTTON");
      expect(getComputedStyle(caption).outlineStyle).toBe("none");
    },
  );

  it("in forced colors: the caption and nav buttons show a Highlight ring on keyboard focus", async () => {
    await emulateForcedColors(true);
    await render(<Calendar locale="en-US" />);
    const prev = page.getByRole("button", { name: "Previous month" }).element() as HTMLElement;
    const month = monthButton().element() as HTMLElement;
    const year = yearButton().element() as HTMLElement;
    const next = page.getByRole("button", { name: "Next month" }).element() as HTMLElement;
    for (const button of [prev, month, year, next]) {
      expect(getComputedStyle(button).outlineStyle).toBe("none");
      await userEvent.tab();
      expect(document.activeElement).toBe(button);
      expect(getComputedStyle(button).outlineStyle).toBe("solid");
      expect(getComputedStyle(button).outlineColor).toBe(systemColor("Highlight"));
    }
  });

  it("the caption buttons have no outline at rest and a 2px ring on Tab focus", async () => {
    await render(<Calendar locale="en-US" />);
    const month = monthButton().element() as HTMLElement;
    expect(getComputedStyle(month).outlineStyle).toBe("none");
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(month);
    expect(getComputedStyle(month).outlineStyle).toBe("solid");
    expect(getComputedStyle(month).outlineWidth).toBe("2px");
  });

  it.each([
    ["month", "light"],
    ["month", "dark"],
    ["year", "light"],
    ["year", "dark"],
  ] as const)("has no axe violations in the %s view (%s)", async (view, theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Calendar
          locale="en-US"
          defaultMonth={d(2026, 9, 1)}
          min={d(2020, 3, 1)}
          max={d(2027, 2, 1)}
        />
      </div>,
    );
    await (view === "month" ? monthButton() : yearButton()).click();
    await expect.element(screen.getByRole("grid")).toBeVisible();
    const results = await axe.run(screen.container);
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.help} ${v.nodes.map((n) => n.html + n.failureSummary).join(" | ")}`,
      ),
    ).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

describe("Calendar views: fix round 1", () => {
  const day = (date: Date) =>
    page.getByRole("button", { name: fullDate(date), exact: true }).element() as HTMLElement;

  it("two months: a day-grid key move into the pane showing a view closes the view and focuses the day", async () => {
    const screen = await render(
      <RangeCalendar locale="en-US" numberOfMonths={2} defaultMonth={d(2026, 9, 1)} />,
    );
    await monthButton("October 2026").click();
    await expect.element(screen.getByRole("grid", { name: "Months, 2026" })).toBeVisible();
    day(d(2026, 9, 15)).focus();
    await userEvent.keyboard("{PageDown}");
    await expect.element(screen.getByRole("grid", { name: "October 2026" })).toBeVisible();
    expect(screen.container.querySelector('[data-slot="calendar-month-grid"]')).toBeNull();
    expect(focusedLabel()).toBe(fullDate(d(2026, 10, 15)));
    expect(tabbable(screen.container, "calendar-day")).toEqual([document.activeElement]);
  });

  it("two months: clicking a day or the other pane's month paging closes the open view", async () => {
    const screen = await render(
      <RangeCalendar locale="en-US" numberOfMonths={2} defaultMonth={d(2026, 9, 1)} />,
    );
    await monthButton("October 2026").click();
    await userEvent.click(day(d(2026, 9, 10)));
    expect(screen.container.querySelector('[data-slot="calendar-month-grid"]')).toBeNull();
    await expect.element(screen.getByRole("grid", { name: "October 2026" })).toBeVisible();
    await yearButton().nth(1).click();
    await screen.getByRole("button", { name: "Previous month" }).click();
    expect(screen.container.querySelector('[data-slot="calendar-year-grid"]')).toBeNull();
    await expect.element(screen.getByRole("grid", { name: "August 2026" })).toBeVisible();
    await expect.element(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();
  });

  it("announces view paging through the live caption", async () => {
    const screen = await render(<Calendar locale="en-US" defaultMonth={d(2026, 9, 1)} />);
    const caption = screen.container.querySelector('[data-slot="calendar-caption"]') as HTMLElement;
    await monthButton().click();
    expect(caption.textContent).toBe("2026");
    await screen.getByRole("button", { name: "Next year" }).click();
    expect(caption.textContent).toBe("2027");
    (monthItem("September 2027").element() as HTMLElement).focus();
    await userEvent.keyboard("{PageDown}");
    expect(caption.textContent).toBe("2028");
    await yearButton("2028").click();
    expect(caption.textContent).toBe(yearRange(2028));
    await screen.getByRole("button", { name: "Previous 12 years" }).click();
    expect(caption.textContent).toBe(yearRange(2016));
    // The same live element all along; back in the days it reads the month again.
    (yearItem(2020).element() as HTMLElement).focus();
    await userEvent.keyboard("{Escape}");
    expect(screen.container.querySelector('[data-slot="calendar-caption"]')).toBe(caption);
    expect(caption.textContent).toBe("September 2026");
  });

  it("the year view's range is a button back to the days", async () => {
    const screen = await render(<Calendar locale="en-US" defaultValue={d(2026, 9, 3)} />);
    await yearButton().click();
    const back = page.getByRole("button", {
      name: `${yearRange(2016)}, Show days, September 2026`,
      exact: true,
    });
    await expect.element(back).toHaveTextContent(yearRange(2016));
    await back.click();
    await expect.element(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();
    expect(focusedLabel()).toBe(fullDate(d(2026, 9, 3)));
  });

  it("the range button's label is translatable", async () => {
    await render(
      <Calendar
        locale="en-US"
        defaultMonth={d(2026, 9, 1)}
        labels={{ showDays: (caption) => `Tage zeigen (${caption})` }}
      />,
    );
    await yearButton().click();
    await expect
      .element(
        page.getByRole("button", { name: `${yearRange(2016)}, Tage zeigen (September 2026)` }),
      )
      .toBeVisible();
  });

  it("two months: choosing a month keeps both panes inside min/max", async () => {
    const onMonthChange = vi.fn();
    const screen = await render(
      <RangeCalendar
        locale="en-US"
        numberOfMonths={2}
        defaultMonth={d(2026, 9, 1)}
        min={d(2024, 3, 15)}
        max={d(2027, 8, 10)}
        onMonthChange={onMonthChange}
      />,
    );
    // The right pane choosing March 2024 would put February 2024 (all before min) on the left.
    await yearButton().nth(1).click();
    await yearItem(2024).click();
    await monthItem("March 2024").click();
    await expect.element(screen.getByRole("grid", { name: "March 2024" })).toBeVisible();
    await expect.element(screen.getByRole("grid", { name: "April 2024" })).toBeVisible();
    expect(onMonthChange).toHaveBeenLastCalledWith(d(2024, 3, 1));
    // The left pane choosing August 2027 would put September 2027 (all after max) on the right.
    await yearButton("2024").first().click();
    await yearItem(2027).click();
    await monthItem("August 2027").click();
    await expect.element(screen.getByRole("grid", { name: "July 2027" })).toBeVisible();
    await expect.element(screen.getByRole("grid", { name: "August 2027" })).toBeVisible();
  });

  it("a controlled month that ignores onMonthChange: choosing a month keeps focus on a day, not <body>", async () => {
    const screen = await render(
      <Calendar locale="en-US" month={d(2026, 9, 1)} onMonthChange={() => {}} />,
    );
    await monthButton().click();
    await monthItem("March 2026").click();
    await expect.element(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.getAttribute("data-slot")).toBe("calendar-day");
    expect(tabbable(screen.container, "calendar-day")).toEqual([document.activeElement]);
  });
});
