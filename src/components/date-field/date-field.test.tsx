import axe from "axe-core";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, systemColor } from "../../../test/emulation";
import { Field, FieldDescription, FieldLabel } from "../field";
import { Input } from "../input";
import { DateField, type DateFieldProps } from "./date-field";

/* "Today" is frozen (Date only; see calendar.test.tsx for why that works in browser mode). */
const TODAY = new Date(2026, 8, 25, 12); // Friday, September 25, 2026

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.classList.remove("dark");
});

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

const root = (scope: ParentNode = document) =>
  scope.querySelector<HTMLElement>("[data-slot=date-field]") as HTMLElement;
const seg = (type: "day" | "month" | "year", scope: ParentNode = document) =>
  scope.querySelector<HTMLElement>(
    `[data-slot=date-field-segment][data-type=${type}]`,
  ) as HTMLElement;
const segments = (scope: ParentNode = document) => [
  ...scope.querySelectorAll<HTMLElement>("[data-slot=date-field-segment]"),
];
const texts = (scope: ParentNode = document) => segments(scope).map((s) => s.textContent);
const focusedType = () => document.activeElement?.getAttribute("data-type") ?? null;

/** Sends one key at a time: focus may move between segments after each. */
async function type(keys: string) {
  for (const key of keys) await userEvent.keyboard(key);
}

function paste(target: HTMLElement, text: string) {
  const data = new DataTransfer();
  data.setData("text/plain", text);
  target.dispatchEvent(
    new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
  );
}

function Basic(props: DateFieldProps) {
  return <DateField aria-label="Due date" locale="en-US" {...props} />;
}

describe("DateField: structure", () => {
  it("renders a group of spinbutton segments in the locale's order, with aria-hidden literals", async () => {
    await render(<Basic className="w-64" />);
    const group = page.getByRole("group", { name: "Due date" });
    await expect.element(group).toBeInTheDocument();
    const element = root();
    expect(element.classList.contains("w-64")).toBe(true);
    expect(segments().map((s) => s.dataset.type)).toEqual(["month", "day", "year"]);
    const literals = element.querySelectorAll("[data-slot=date-field-literal]");
    expect([...literals].map((l) => l.textContent)).toEqual(["/", "/"]);
    for (const literal of literals) expect(literal.getAttribute("aria-hidden")).toBe("true");
    for (const s of segments()) {
      expect(s.getAttribute("role")).toBe("spinbutton");
      expect(s.tabIndex).toBe(0);
      expect(s.getAttribute("inputmode")).toBe("numeric");
    }
  });

  it("shows localised placeholders in the muted colour with data-placeholder while empty", async () => {
    const screen = await render(
      <div>
        <Basic />
        <span data-testid="muted" className="text-muted-foreground" />
      </div>,
    );
    expect(texts()).toEqual(["mm", "dd", "yyyy"]);
    const month = seg("month");
    expect(month.hasAttribute("data-placeholder")).toBe(true);
    expect(getComputedStyle(month).color).toBe(
      getComputedStyle(screen.getByTestId("muted").element()).color,
    );
  });

  it("exposes spinbutton values: aria-valuenow / min / max / valuetext and a localised aria-label", async () => {
    await render(<Basic defaultValue={d(2026, 9, 25)} />);
    const month = seg("month");
    expect(month.getAttribute("aria-label")).toBe("month");
    expect(month.getAttribute("aria-valuenow")).toBe("9");
    expect(month.getAttribute("aria-valuemin")).toBe("1");
    expect(month.getAttribute("aria-valuemax")).toBe("12");
    expect(month.getAttribute("aria-valuetext")).toBe("September");
    const day = seg("day");
    expect(day.getAttribute("aria-label")).toBe("day");
    expect(day.getAttribute("aria-valuemax")).toBe("30");
    expect(day.getAttribute("aria-valuetext")).toBe("25");
    const year = seg("year");
    expect(year.getAttribute("aria-valuemin")).toBe("1");
    expect(year.getAttribute("aria-valuemax")).toBe("9999");
    expect(year.getAttribute("aria-valuetext")).toBe("2026");
    expect(texts()).toEqual(["09", "25", "2026"]);
    expect(month.hasAttribute("data-placeholder")).toBe(false);
  });

  it("names each segment by its own name plus the field's ('month Due date'), keeping the group name", async () => {
    await render(<Basic />);
    await expect.element(page.getByRole("group", { name: "Due date" })).toBeInTheDocument();
    for (const name of ["month Due date", "day Due date", "year Due date"]) {
      await expect.element(page.getByRole("spinbutton", { name, exact: true })).toBeInTheDocument();
    }
    const month = seg("month");
    expect(month.getAttribute("aria-labelledby")).toBe(`${month.id} ${root().id}`);
  });

  it("names segments from an external aria-labelledby", async () => {
    await render(
      <div>
        <span id="ext">Start</span>
        <DateField aria-labelledby="ext" locale="en-US" />
      </div>,
    );
    await expect.element(page.getByRole("group", { name: "Start" })).toBeInTheDocument();
    await expect
      .element(page.getByRole("spinbutton", { name: "day Start", exact: true }))
      .toBeInTheDocument();
  });

  it("says 'Empty' (localisable) for an unset segment and omits aria-valuenow", async () => {
    const { rerender } = await render(<Basic />);
    expect(seg("day").getAttribute("aria-valuetext")).toBe("Empty");
    expect(seg("day").hasAttribute("aria-valuenow")).toBe(false);
    await rerender(<Basic labels={{ empty: "Leer", day: "Tag" }} />);
    expect(seg("day").getAttribute("aria-valuetext")).toBe("Leer");
    expect(seg("day").getAttribute("aria-label")).toBe("Tag");
  });
});

describe("DateField: typing", () => {
  it("types a full date with auto-advance and reports it once", async () => {
    const onValueChange = vi.fn();
    await render(<Basic onValueChange={onValueChange} />);
    await userEvent.click(seg("month"));
    await type("0925");
    expect(focusedType()).toBe("year");
    expect(onValueChange).not.toHaveBeenCalled();
    await type("2026");
    expect(texts()).toEqual(["09", "25", "2026"]);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(d(2026, 9, 25));
    // The year stays focused after its fourth digit (no segment after it).
    expect(focusedType()).toBe("year");
  });

  it("holds a year until its fourth digit or blur (no report for 2, 20, 202 on the way)", async () => {
    const onValueChange = vi.fn();
    await render(
      <div>
        <Basic onValueChange={onValueChange} min={d(1000, 1, 1)} />
        <button type="button">after</button>
      </div>,
    );
    await userEvent.click(seg("month"));
    await type("0925202");
    expect(onValueChange).not.toHaveBeenCalled();
    // A held short year never flags min while it is typed.
    expect(root().hasAttribute("data-invalid")).toBe(false);
    await userEvent.tab();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    const date = onValueChange.mock.lastCall?.[0] as Date;
    expect(date.getFullYear()).toBe(202);
    expect(root().hasAttribute("data-invalid")).toBe(true);
  });

  it.each([
    ["en-US", "0229"],
    ["de-DE", "2902"],
  ])(
    "%s: types Feb 29 of a leap year (the day isn't clamped while the year is typed)",
    async (locale, dayMonth) => {
      const onValueChange = vi.fn();
      await render(<DateField aria-label="Date" locale={locale} onValueChange={onValueChange} />);
      await userEvent.click(segments()[0] as HTMLElement);
      await type(dayMonth);
      await type("2");
      // Year "2" is held: the day keeps 29 and its bound reads as if the year were unknown.
      expect(seg("day").getAttribute("aria-valuenow")).toBe("29");
      expect(seg("day").getAttribute("aria-valuemax")).toBe("31");
      await type("024");
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenLastCalledWith(d(2024, 2, 29));
      expect(seg("day").getAttribute("aria-valuemax")).toBe("29");
    },
  );

  it("clamps Feb 29 once a common year's fourth digit is in (or on blur)", async () => {
    const onValueChange = vi.fn();
    await render(
      <div>
        <Basic onValueChange={onValueChange} />
        <button type="button">after</button>
      </div>,
    );
    await userEvent.click(seg("month"));
    await type("02292023");
    expect(onValueChange).toHaveBeenLastCalledWith(d(2023, 2, 28));
    expect(seg("day").getAttribute("aria-valuenow")).toBe("28");
    // Clear the year so the day is bounded by 31 again, type 29, then a held year 202.
    await userEvent.click(seg("year"));
    await userEvent.keyboard("{Backspace}");
    await userEvent.click(seg("day"));
    await type("29");
    expect(focusedType()).toBe("year");
    await type("202");
    expect(seg("day").getAttribute("aria-valuenow")).toBe("29");
    await userEvent.tab();
    // Blur reports the held year 202 (a common year): the day clamps.
    expect(seg("day").getAttribute("aria-valuenow")).toBe("28");
    const last = onValueChange.mock.lastCall as [Date];
    expect(last[0].getFullYear()).toBe(202);
  });

  it("a leading '0' shows (and announces) the typed digit while the value is still empty", async () => {
    await render(<Basic />);
    await userEvent.click(seg("month"));
    await type("0");
    expect(seg("month").textContent).toBe("0");
    expect(seg("month").getAttribute("aria-valuetext")).toBe("0");
    expect(seg("month").hasAttribute("aria-valuenow")).toBe(false);
    await type("9");
    expect(seg("month").getAttribute("aria-valuetext")).toBe("September");
  });

  it("month: '1' waits for a second digit, '2'–'9' advance at once", async () => {
    await render(<Basic />);
    await userEvent.click(seg("month"));
    await type("1");
    expect(focusedType()).toBe("month");
    expect(seg("month").getAttribute("aria-valuenow")).toBe("1");
    await type("2");
    expect(seg("month").getAttribute("aria-valuenow")).toBe("12");
    expect(focusedType()).toBe("day");
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await type("3");
    expect(seg("month").getAttribute("aria-valuenow")).toBe("3");
    expect(focusedType()).toBe("day");
  });

  it("day: '4'–'9' advance at once, '1'–'3' wait", async () => {
    await render(<Basic />);
    await userEvent.click(seg("day"));
    await type("3");
    expect(focusedType()).toBe("day");
    await type("1");
    expect(seg("day").getAttribute("aria-valuenow")).toBe("31");
    expect(focusedType()).toBe("year");
    await userEvent.click(seg("day"));
    await type("5");
    expect(seg("day").getAttribute("aria-valuenow")).toBe("5");
    expect(focusedType()).toBe("year");
  });

  it("clamps the day when the month and year make it too long (Jan 31 → Feb 28)", async () => {
    await render(<Basic defaultValue={d(2026, 1, 31)} />);
    await userEvent.click(seg("month"));
    await type("2");
    expect(seg("day").getAttribute("aria-valuenow")).toBe("28");
    expect(seg("day").getAttribute("aria-valuemax")).toBe("28");
  });

  it("typing the literal separator moves to the next segment", async () => {
    await render(<Basic />);
    await userEvent.click(seg("month"));
    await type("1");
    await type("/");
    expect(focusedType()).toBe("day");
    await type("5");
    expect(focusedType()).toBe("year");
  });

  it("types through beforeinput too (mobile keyboards send 'Unidentified' keydowns)", async () => {
    const onValueChange = vi.fn();
    await render(<Basic defaultValue={d(2026, 9, 25)} onValueChange={onValueChange} />);
    await userEvent.click(seg("month"));
    const input = (inputType: string, data: string | null) => {
      const event = new InputEvent("beforeinput", {
        inputType,
        data,
        bubbles: true,
        cancelable: true,
      });
      (document.activeElement as HTMLElement).dispatchEvent(event);
      return event;
    };
    expect(input("insertText", "4").defaultPrevented).toBe(true);
    await expect.poll(focusedType).toBe("day");
    expect(onValueChange).toHaveBeenLastCalledWith(d(2026, 4, 25));
    input("deleteContentBackward", null);
    await expect.poll(() => seg("day").textContent).toBe("dd");
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    // Letters never reach the DOM.
    expect(input("insertText", "x").defaultPrevented).toBe(true);
    expect(seg("day").textContent).toBe("dd");
  });

  it("ignores letters", async () => {
    const onValueChange = vi.fn();
    await render(<Basic onValueChange={onValueChange} />);
    await userEvent.click(seg("month"));
    await type("ab");
    expect(texts()).toEqual(["mm", "dd", "yyyy"]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("keeps years below 100 literal (year 4, not 1904)", async () => {
    const onValueChange = vi.fn();
    await render(<Basic onValueChange={onValueChange} />);
    await userEvent.click(seg("month"));
    await type("0229");
    await type("0004");
    const date = onValueChange.mock.lastCall?.[0] as Date;
    expect(date.getFullYear()).toBe(4);
    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(29);
    expect(texts()).toEqual(["02", "29", "4"]);
  });
});

describe("DateField: keys", () => {
  it("ArrowUp / ArrowDown step with wrap; an empty segment starts at today's value", async () => {
    await render(<Basic />);
    await userEvent.click(seg("month"));
    await userEvent.keyboard("{ArrowUp}");
    expect(seg("month").getAttribute("aria-valuenow")).toBe("9");
    await userEvent.keyboard("{ArrowUp}");
    expect(seg("month").getAttribute("aria-valuenow")).toBe("10");
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(seg("month").getAttribute("aria-valuenow")).toBe("1");
    await userEvent.keyboard("{ArrowDown}");
    expect(seg("month").getAttribute("aria-valuenow")).toBe("12");
    // Arrows never move focus between segments.
    expect(focusedType()).toBe("month");
  });

  it("Home / End jump to the segment's min / max", async () => {
    await render(<Basic defaultValue={d(2026, 2, 10)} />);
    await userEvent.click(seg("day"));
    await userEvent.keyboard("{End}");
    expect(seg("day").getAttribute("aria-valuenow")).toBe("28");
    await userEvent.keyboard("{Home}");
    expect(seg("day").getAttribute("aria-valuenow")).toBe("1");
  });

  it("PageUp / PageDown step month by 1, day by 7, year by 10", async () => {
    await render(<Basic defaultValue={d(2026, 9, 25)} />);
    await userEvent.click(seg("month"));
    await userEvent.keyboard("{PageUp}");
    expect(seg("month").getAttribute("aria-valuenow")).toBe("10");
    await userEvent.click(seg("day"));
    await userEvent.keyboard("{PageUp}");
    expect(seg("day").getAttribute("aria-valuenow")).toBe("1"); // 25 + 7 in October's 1–31 → 32 wraps to 1
    await userEvent.keyboard("{PageDown}");
    expect(seg("day").getAttribute("aria-valuenow")).toBe("25");
    await userEvent.click(seg("year"));
    await userEvent.keyboard("{PageDown}");
    expect(seg("year").getAttribute("aria-valuenow")).toBe("2016");
  });

  it("Backspace / Delete clear a segment; Backspace on an empty one moves to the previous", async () => {
    await render(<Basic defaultValue={d(2026, 9, 25)} />);
    await userEvent.click(seg("year"));
    await userEvent.keyboard("{Backspace}");
    expect(seg("year").textContent).toBe("yyyy");
    expect(focusedType()).toBe("year");
    await userEvent.keyboard("{Backspace}");
    expect(focusedType()).toBe("day");
    expect(seg("day").getAttribute("aria-valuenow")).toBe("25");
    await userEvent.keyboard("{Delete}");
    expect(seg("day").textContent).toBe("dd");
    expect(focusedType()).toBe("day");
  });

  it("ArrowLeft / ArrowRight and Tab move between segments (each is a Tab stop)", async () => {
    await render(
      <div>
        <Basic />
        <button type="button">after</button>
      </div>,
    );
    await userEvent.tab();
    expect(focusedType()).toBe("month");
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedType()).toBe("day");
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedType()).toBe("year");
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedType()).toBe("year");
    await userEvent.keyboard("{ArrowLeft}");
    expect(focusedType()).toBe("day");
    await userEvent.tab();
    expect(focusedType()).toBe("year");
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe("after");
  });

  it("pastes a full date in the locale's format or ISO", async () => {
    const onValueChange = vi.fn();
    await render(<Basic onValueChange={onValueChange} />);
    await userEvent.click(seg("day"));
    paste(seg("day"), "9/25/2026");
    await expect.poll(() => texts()).toEqual(["09", "25", "2026"]);
    expect(onValueChange).toHaveBeenLastCalledWith(d(2026, 9, 25));
    paste(seg("day"), "2027-01-02");
    await expect.poll(() => texts()).toEqual(["01", "02", "2027"]);
    expect(onValueChange).toHaveBeenLastCalledWith(d(2027, 1, 2));
    expect(onValueChange).toHaveBeenCalledTimes(2);
    paste(seg("day"), "not a date");
    paste(seg("day"), "02/30/2026");
    // A valid paste after the junk settles first, so the junk had its chance to report.
    paste(seg("day"), "2027-01-03");
    await expect.poll(() => texts()).toEqual(["01", "03", "2027"]);
    expect(onValueChange).toHaveBeenCalledTimes(3);
    expect(onValueChange).toHaveBeenLastCalledWith(d(2027, 1, 3));
  });
});

describe("DateField: locales and RTL", () => {
  it.each([
    ["de-DE", ["day", "month", "year"], ".", ["tt", "mm", "jjjj"]],
    ["en-GB", ["day", "month", "year"], "/", ["dd", "mm", "yyyy"]],
    ["ja-JP", ["year", "month", "day"], "/", ["yyyy", "mm", "dd"]],
  ] as const)(
    "%s: segment order, separator and placeholders",
    async (locale, order, literal, placeholders) => {
      await render(<DateField aria-label="Datum" locale={locale} />);
      expect(segments().map((s) => s.dataset.type)).toEqual(order);
      expect(root().querySelector("[data-slot=date-field-literal]")?.textContent).toBe(literal);
      expect(texts()).toEqual(placeholders);
    },
  );

  it("de-DE: localised segment names and month text", async () => {
    await render(<DateField aria-label="Datum" locale="de-DE" defaultValue={d(2026, 9, 25)} />);
    expect(seg("month").getAttribute("aria-label")).toBe("Monat");
    expect(seg("month").getAttribute("aria-valuetext")).toBe("September");
    expect(texts()).toEqual(["25", "09", "2026"]);
  });

  it("ar-EG in RTL: Arabic-Indic digits, ASCII and Arabic typing, and flipped arrows", async () => {
    const onValueChange = vi.fn();
    await render(
      <div dir="rtl">
        <DateField aria-label="التاريخ" locale="ar-EG" onValueChange={onValueChange} />
      </div>,
    );
    expect(segments().map((s) => s.dataset.type)).toEqual(["day", "month", "year"]);
    await userEvent.click(seg("day"));
    await type("2");
    await type("٥");
    expect(focusedType()).toBe("month");
    // In RTL the next segment sits to the left: ArrowRight goes back, ArrowLeft forward.
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedType()).toBe("day");
    await userEvent.keyboard("{ArrowLeft}");
    expect(focusedType()).toBe("month");
    await type("9");
    await type("٢٠٢6");
    expect(onValueChange).toHaveBeenLastCalledWith(d(2026, 9, 25));
    expect(texts()).toEqual(["٢٥", "٠٩", "٢٠٢٦"]);
    // Visually right to left: the day is the rightmost segment.
    expect(seg("day").getBoundingClientRect().left).toBeGreaterThan(
      seg("year").getBoundingClientRect().left,
    );
  });
});

describe("DateField: validation", () => {
  it.each([
    ["before min", { min: d(2026, 10, 1) }],
    ["after max", { max: d(2026, 9, 1) }],
    ["a disabled date", { isDateDisabled: (date: Date) => date.getDay() === 5 }],
  ])(
    "is invalid for %s: data-invalid on the group, aria-invalid on each segment",
    async (_, props) => {
      const onValueChange = vi.fn();
      await render(<Basic {...props} onValueChange={onValueChange} />);
      const element = root();
      expect(element.hasAttribute("data-invalid")).toBe(false);
      await userEvent.click(seg("month"));
      await type("09252026");
      expect(onValueChange).toHaveBeenLastCalledWith(d(2026, 9, 25));
      expect(element.hasAttribute("data-invalid")).toBe(true);
      for (const s of segments()) expect(s.getAttribute("aria-invalid")).toBe("true");
    },
  );

  it("moves an aria-invalid prop onto the segments (not the group)", async () => {
    await render(<Basic aria-invalid="true" />);
    expect(root().hasAttribute("aria-invalid")).toBe(false);
    expect(root().hasAttribute("data-invalid")).toBe(true);
    expect(seg("year").getAttribute("aria-invalid")).toBe("true");
  });

  it("is valid inside [min, max]", async () => {
    await render(<Basic min={d(2026, 9, 1)} max={d(2026, 9, 30)} defaultValue={d(2026, 9, 25)} />);
    expect(root().hasAttribute("data-invalid")).toBe(false);
    expect(seg("day").hasAttribute("aria-invalid")).toBe(false);
  });

  it("shows the danger border while invalid", async () => {
    const screen = await render(
      <div>
        <Basic max={d(2026, 1, 1)} defaultValue={d(2026, 9, 25)} />
        <div data-testid="ref" className="border border-danger" />
      </div>,
    );
    expect(getComputedStyle(root()).borderTopColor).toBe(
      getComputedStyle(screen.getByTestId("ref").element()).borderTopColor,
    );
  });
});

describe("DateField: value", () => {
  it("onValueChange: partial input never fires; clearing a segment of a complete value fires null", async () => {
    const onValueChange = vi.fn();
    await render(<Basic defaultValue={d(2026, 9, 25)} onValueChange={onValueChange} />);
    await userEvent.click(seg("day"));
    await userEvent.keyboard("{Backspace}");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    await userEvent.click(seg("month"));
    await type("1");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.click(seg("day"));
    await type("4");
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenLastCalledWith(d(2026, 1, 4));
  });

  it("controlled: follows an external value change", async () => {
    const { rerender } = await render(<Basic value={d(2026, 9, 25)} />);
    expect(texts()).toEqual(["09", "25", "2026"]);
    await rerender(<Basic value={d(2027, 1, 2)} />);
    expect(texts()).toEqual(["01", "02", "2027"]);
    await rerender(<Basic value={null} />);
    expect(texts()).toEqual(["mm", "dd", "yyyy"]);
  });

  it("controlled: a parent re-render with the same value keeps partial input", async () => {
    function Parent() {
      const [value, setValue] = useState<Date | null>(null);
      const [, setTick] = useState(0);
      return (
        <div>
          <Basic value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setTick((t) => t + 1)}>
            rerender
          </button>
          <output>{value ? value.toDateString() : "none"}</output>
        </div>
      );
    }
    const screen = await render(<Parent />);
    await userEvent.click(seg("month"));
    await type("09");
    await userEvent.click(screen.getByRole("button", { name: "rerender" }));
    expect(texts()).toEqual(["09", "dd", "yyyy"]);
    await userEvent.click(seg("day"));
    await type("252026");
    await expect.element(screen.getByText(d(2026, 9, 25).toDateString())).toBeInTheDocument();
  });

  it("controlled: a parent that ignores changes keeps its value", async () => {
    await render(<Basic value={d(2026, 9, 25)} />);
    await userEvent.click(seg("day"));
    await type("4");
    expect(texts()).toEqual(["09", "25", "2026"]);
  });

  it("uncontrolled: keeps its own value from defaultValue", async () => {
    await render(<Basic defaultValue={d(2026, 9, 25)} />);
    await userEvent.click(seg("day"));
    await type("4");
    expect(texts()).toEqual(["09", "04", "2026"]);
  });

  it("submits the ISO value under `name` (empty when unset) through native FormData", async () => {
    let data: FormData | null = null;
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <Basic name="due" defaultValue={d(2026, 9, 5)} />
        <Basic aria-label="Other" name="other" />
        <button type="submit">Save</button>
      </form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => data).not.toBeNull();
    const form = data as unknown as FormData;
    expect(form.get("due")).toBe("2026-09-05");
    expect(form.get("other")).toBe("");
  });
});

describe("DateField: states", () => {
  it("disabled: no Tab stops, aria-disabled segments, not-allowed cursor, ignores clicks", async () => {
    await render(
      <div>
        <Basic disabled defaultValue={d(2026, 9, 25)} />
        <button type="button">after</button>
      </div>,
    );
    const element = root();
    expect(element.hasAttribute("data-disabled")).toBe(true);
    expect(getComputedStyle(element).cursor).toBe("not-allowed");
    expect(getComputedStyle(element).opacity).toBe("0.5");
    for (const s of segments()) {
      expect(s.tabIndex).toBe(-1);
      expect(s.getAttribute("aria-disabled")).toBe("true");
    }
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe("after");
  });

  it("disabled: clicking a segment doesn't focus it (no tabindex at all)", async () => {
    await render(<Basic disabled defaultValue={d(2026, 9, 25)} />);
    const before = document.activeElement;
    for (const s of segments()) expect(s.hasAttribute("tabindex")).toBe(false);
    await userEvent.click(seg("day"), { force: true });
    expect(document.activeElement).toBe(before);
    expect(getComputedStyle(seg("day")).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  });

  it("readOnly: the stepping keys don't scroll the page (they are prevented)", async () => {
    await render(<Basic readOnly defaultValue={d(2026, 9, 25)} />);
    const prevented: Record<string, boolean> = {};
    const listener = (event: KeyboardEvent) => {
      prevented[event.key] = event.defaultPrevented;
    };
    window.addEventListener("keydown", listener);
    try {
      await userEvent.click(seg("month"));
      for (const key of ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]) {
        await userEvent.keyboard(`{${key}}`);
      }
    } finally {
      window.removeEventListener("keydown", listener);
    }
    expect(prevented).toEqual({
      ArrowUp: true,
      ArrowDown: true,
      PageUp: true,
      PageDown: true,
      Home: true,
      End: true,
    });
    expect(texts()).toEqual(["09", "25", "2026"]);
  });

  it("readOnly: focusable and navigable, but keys never change the value", async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <div>
        <Basic readOnly defaultValue={d(2026, 9, 25)} onValueChange={onValueChange} />
        <div data-testid="muted" className="bg-muted" />
      </div>,
    );
    const element = root();
    expect(element.hasAttribute("data-readonly")).toBe(true);
    expect(getComputedStyle(element).backgroundColor).toBe(
      getComputedStyle(screen.getByTestId("muted").element()).backgroundColor,
    );
    await userEvent.click(seg("month"));
    expect(seg("month").getAttribute("aria-readonly")).toBe("true");
    await userEvent.keyboard("{ArrowUp}");
    await type("4");
    await userEvent.keyboard("{Backspace}");
    paste(seg("month"), "2027-01-02");
    expect(texts()).toEqual(["09", "25", "2026"]);
    expect(onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedType()).toBe("day");
  });

  it("clicking the padding focuses the first empty segment (else the first)", async () => {
    await render(<Basic defaultValue={null} className="w-80" />);
    const element = root();
    const box = element.getBoundingClientRect();
    await userEvent.click(element, { position: { x: box.width - 4, y: box.height / 2 } });
    expect(focusedType()).toBe("month");
    await type("09");
    await userEvent.click(seg("year"));
    await userEvent.click(element, { position: { x: box.width - 4, y: box.height / 2 } });
    expect(focusedType()).toBe("day");
    await userEvent.click(seg("day"));
    await type("252026");
    await userEvent.click(element, { position: { x: box.width - 4, y: box.height / 2 } });
    expect(focusedType()).toBe("month");
  });

  it("sits at the Input heights, padding and font per size", async () => {
    const screen = await render(
      <div className="flex flex-col gap-2">
        {(["sm", "md", "lg"] as const).map((size) => (
          <div key={size} className="flex gap-2">
            <Input aria-label={`input-${size}`} size={size} />
            <DateField aria-label={`date-${size}`} size={size} locale="en-US" />
          </div>
        ))}
        <DateField aria-label="date-default" locale="en-US" />
      </div>,
    );
    const heights = { sm: 32, md: 40, lg: 48 };
    for (const size of ["sm", "md", "lg"] as const) {
      const input = screen.getByRole("textbox", { name: `input-${size}` }).element();
      const date = screen.getByRole("group", { name: `date-${size}` }).element();
      expect(date.getBoundingClientRect().height).toBe(heights[size]);
      expect(date.getAttribute("data-size")).toBe(size);
      const i = getComputedStyle(input);
      const s = getComputedStyle(date);
      expect(s.paddingLeft).toBe(i.paddingLeft);
      expect(s.fontSize).toBe(i.fontSize);
      expect(s.backgroundColor).toBe(i.backgroundColor);
      expect(s.borderTopColor).toBe(i.borderTopColor);
      expect(s.borderRadius).toBe(i.borderRadius);
    }
    const fallback = screen.getByRole("group", { name: "date-default" }).element();
    expect(fallback.getAttribute("data-size")).toBe("md");
  });
});

describe("DateField: focus", () => {
  it("a focused segment rings the group (solid 1px) and fills the segment with primary", async () => {
    const screen = await render(
      <div>
        <Basic />
        <span data-testid="primary" className="bg-primary text-primary-foreground" />
      </div>,
    );
    const element = root();
    expect(getComputedStyle(element).outlineStyle).toBe("none");
    await userEvent.tab();
    const style = getComputedStyle(element);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("1px");
    const ref = getComputedStyle(screen.getByTestId("primary").element());
    const month = getComputedStyle(seg("month"));
    expect(month.backgroundColor).toBe(ref.backgroundColor);
    expect(month.color).toBe(ref.color);
  });

  it("in forced colors: no ring until focused, then a Highlight ring and a Highlight segment", async () => {
    await render(<Basic defaultValue={d(2026, 9, 25)} />);
    await emulateForcedColors(true);
    const element = root();
    expect(getComputedStyle(element).outlineStyle).toBe("none");
    expect(getComputedStyle(seg("day")).forcedColorAdjust).toBe("auto");
    await userEvent.click(seg("day"));
    expect(getComputedStyle(element).outlineStyle).toBe("solid");
    expect(getComputedStyle(element).outlineColor).toBe(systemColor("Highlight"));
    const day = getComputedStyle(seg("day"));
    expect(day.backgroundColor).toBe(systemColor("Highlight"));
    expect(day.color).toBe(systemColor("HighlightText"));
    expect(day.forcedColorAdjust).toBe("none");
    expect(getComputedStyle(seg("month")).forcedColorAdjust).toBe("auto");
  });

  it("in forced colors: an invalid, focused field rings Highlight, like an Input in an invalid Field", async () => {
    const screen = await render(
      <div className="flex flex-col gap-2">
        <Field invalid>
          <FieldLabel>input</FieldLabel>
          <Input />
        </Field>
        <Basic max={d(2026, 1, 1)} defaultValue={d(2026, 9, 25)} />
      </div>,
    );
    await emulateForcedColors(true);
    const input = screen.getByRole("textbox", { name: "input" }).element() as HTMLInputElement;
    input.focus();
    const inputRing = getComputedStyle(input).outlineColor;
    await userEvent.click(seg("day"));
    const style = getComputedStyle(root());
    expect(style.outlineStyle).toBe("solid");
    // Input's `:focus` ring stays Highlight when invalid; the group's `:focus-within` ring needs
    // `forced-colors:data-invalid:focus-within:outline-[Highlight]` for the same result (without
    // it the danger outline, forced to CanvasText, wins by source order).
    expect(inputRing).toBe(systemColor("Highlight"));
    expect(style.outlineColor).toBe(inputRing);
  });
});

describe("DateField: in Field", () => {
  it("the label names the group, the description describes it, invalid shows the danger border", async () => {
    const screen = await render(
      <div>
        <Field invalid>
          <FieldLabel>Due date</FieldLabel>
          <DateField locale="en-US" defaultValue={d(2026, 9, 25)} />
          <FieldDescription>When the invoice is due.</FieldDescription>
        </Field>
        <div data-testid="ref" className="border border-danger" />
      </div>,
    );
    const group = page.getByRole("group", { name: "Due date" });
    await expect.element(group).toBeInTheDocument();
    await expect.element(group).toHaveAccessibleDescription("When the invoice is due.");
    const element = root();
    const label = document.querySelector("[data-slot=field-label]") as HTMLLabelElement;
    expect(element.getAttribute("aria-labelledby")).toBe(label.id);
    await expect
      .element(page.getByRole("spinbutton", { name: "month Due date", exact: true }))
      .toBeInTheDocument();
    expect(seg("month").getAttribute("aria-labelledby")).toBe(`${seg("month").id} ${label.id}`);
    // The group is not labelable: the label points at no control (no `for`).
    expect(label.htmlFor).toBe("");
    expect(element.hasAttribute("data-invalid")).toBe(true);
    expect(seg("day").getAttribute("aria-invalid")).toBe("true");
    expect(getComputedStyle(element).borderTopColor).toBe(
      getComputedStyle(screen.getByTestId("ref").element()).borderTopColor,
    );
  });

  it("clicking the label focuses the first segment", async () => {
    await render(
      <Field>
        <FieldLabel>Due date</FieldLabel>
        <DateField locale="en-US" />
      </Field>,
    );
    await userEvent.click(document.querySelector("[data-slot=field-label]") as HTMLElement);
    expect(focusedType()).toBe("month");
  });

  it("a disabled Field disables it", async () => {
    await render(
      <Field disabled>
        <FieldLabel>Due date</FieldLabel>
        <DateField locale="en-US" />
      </Field>,
    );
    expect(root().hasAttribute("data-disabled")).toBe(true);
    for (const s of segments()) expect(s.tabIndex).toBe(-1);
  });
});

describe("DateField: accessibility", () => {
  it.each(["light", "dark"] as const)("has no axe violations (%s)", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    const screen = await render(
      <div className="flex flex-col gap-4 bg-background p-4">
        <Field>
          <FieldLabel>Due date</FieldLabel>
          <DateField locale="en-US" defaultValue={d(2026, 9, 25)} />
          <FieldDescription>When the invoice is due.</FieldDescription>
        </Field>
        <DateField aria-label="Empty" locale="en-US" />
        <DateField aria-label="Invalid" locale="en-US" max={d(2026, 1, 1)} defaultValue={TODAY} />
        <DateField aria-label="Disabled" locale="en-US" disabled defaultValue={TODAY} />
        <DateField aria-label="Read-only" locale="en-US" readOnly defaultValue={TODAY} />
        <div dir="rtl">
          <DateField aria-label="التاريخ" locale="ar-EG" defaultValue={TODAY} />
        </div>
      </div>,
    );
    await userEvent.click(seg("day"));
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
  });
});
