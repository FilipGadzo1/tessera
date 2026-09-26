import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, systemColor } from "../../../test/emulation";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import type { DateRange } from "../calendar";
import { Dialog, DialogContent, DialogTitle } from "../dialog";
import { Field, FieldDescription, FieldLabel } from "../field";
import { Input } from "../input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";
import { DatePicker, type DatePickerProps, DateRangePicker } from "./date-picker";

/* "Today" is frozen (Date only; see calendar.test.tsx for why that works in browser mode). */
const TODAY = new Date(2026, 8, 25, 12); // Friday, September 25, 2026

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});

afterEach(async () => {
  vi.useRealTimers();
  document.documentElement.classList.remove("dark");
  await emulateForcedColors(false);
});

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const fullDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(date);
const medium = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);

const dialog = () => page.getByRole("dialog");
const popup = () => document.querySelector<HTMLElement>("[data-slot=date-picker-content]");
const dayButton = (date: Date) => page.getByRole("button", { name: fullDate(date), exact: true });
const triggerEl = () =>
  document.querySelector<HTMLButtonElement>("[data-slot=date-picker-trigger]") as HTMLButtonElement;
const focusedDayLabel = () =>
  document.activeElement?.getAttribute("data-slot") === "calendar-day"
    ? document.activeElement.getAttribute("aria-label")
    : null;

async function open() {
  await userEvent.click(triggerEl());
  await expect.element(dialog()).toBeVisible();
  const element = popup() as HTMLElement;
  await waitForPopupSettled(element);
  return element;
}

function Picker(props: DatePickerProps) {
  // Padding leaves room on every side, so the popup never flips.
  return (
    <div className="p-16">
      <DatePicker aria-label="Due date" locale="en-US" {...props} />
    </div>
  );
}

describe("DatePicker: trigger", () => {
  it("shows the placeholder in the muted colour with data-placeholder, and a leading calendar icon", async () => {
    const screen = await render(
      <div>
        <Picker />
        <span data-testid="muted" className="text-muted-foreground" />
      </div>,
    );
    const trigger = triggerEl();
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.type).toBe("button");
    expect(trigger.hasAttribute("data-placeholder")).toBe(true);
    const value = trigger.querySelector("[data-slot=date-picker-value]") as HTMLElement;
    expect(value.textContent).toBe("Pick a date");
    expect(getComputedStyle(value).color).toBe(
      getComputedStyle(screen.getByTestId("muted").element()).color,
    );
    const icon = trigger.querySelector("svg") as SVGElement;
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.getBoundingClientRect().left).toBeLessThan(value.getBoundingClientRect().left);
    // Left-aligned: the value sits right after the icon, not pushed to the end.
    expect(value.getBoundingClientRect().left - icon.getBoundingClientRect().right).toBeLessThan(
      12,
    );
    await expect.element(page.getByRole("button", { name: "Due date" })).toBeInTheDocument();
  });

  it("shows the value with the medium date style by default, and honours format / locale / placeholder", async () => {
    const screen = await render(
      <div className="flex flex-col gap-2">
        <DatePicker aria-label="A" locale="en-US" defaultValue={d(2026, 9, 25)} />
        <DatePicker
          aria-label="B"
          locale="de-DE"
          format={{ dateStyle: "long" }}
          defaultValue={d(2026, 9, 25)}
        />
        <DatePicker aria-label="C" placeholder="When?" />
      </div>,
    );
    const triggers = screen.container.querySelectorAll("[data-slot=date-picker-trigger]");
    expect(triggers[0]?.textContent).toBe("Sep 25, 2026");
    expect(triggers[0]?.hasAttribute("data-placeholder")).toBe(false);
    expect(triggers[1]?.textContent).toBe("25. September 2026");
    expect(triggers[2]?.textContent).toBe("When?");
  });

  it("names itself from aria-label plus the value (value text follows the label)", async () => {
    await render(<Picker defaultValue={d(2026, 9, 25)} />);
    await expect
      .element(page.getByRole("button", { name: "Due date Sep 25, 2026", exact: true }))
      .toBeInTheDocument();
  });

  it("names itself from aria-labelledby plus the value", async () => {
    await render(
      <div>
        <span id="lbl">Start date</span>
        <DatePicker aria-labelledby="lbl" locale="en-US" defaultValue={d(2026, 9, 1)} />
      </div>,
    );
    await expect
      .element(page.getByRole("button", { name: "Start date Sep 1, 2026", exact: true }))
      .toBeInTheDocument();
  });

  it("sits at the Select / Input heights per size", async () => {
    const screen = await render(
      <div className="flex flex-col gap-2">
        {(["sm", "md", "lg"] as const).map((size) => (
          <div key={size} className="flex gap-2">
            <Input aria-label={`input-${size}`} size={size} />
            <Select items={{ a: "A" }}>
              <SelectTrigger aria-label={`select-${size}`} size={size}>
                <SelectValue placeholder="Pick" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">A</SelectItem>
              </SelectContent>
            </Select>
            <DatePicker aria-label={`date-${size}`} size={size} />
          </div>
        ))}
        <DatePicker aria-label="date-default" />
      </div>,
    );
    const heights = { sm: 32, md: 40, lg: 48 };
    for (const size of ["sm", "md", "lg"] as const) {
      const input = screen.getByRole("textbox", { name: `input-${size}` }).element();
      const select = screen.getByRole("combobox", { name: `select-${size}` }).element();
      const date = screen.getByRole("button", { name: `date-${size}` }).element();
      expect(date.getBoundingClientRect().height).toBe(heights[size]);
      expect(date.getBoundingClientRect().height).toBe(select.getBoundingClientRect().height);
      expect(date.getAttribute("data-size")).toBe(size);
      const i = getComputedStyle(input);
      const s = getComputedStyle(date);
      expect(s.paddingLeft).toBe(i.paddingLeft);
      expect(s.fontSize).toBe(i.fontSize);
      expect(s.backgroundColor).toBe(i.backgroundColor);
      expect(s.borderTopColor).toBe(i.borderTopColor);
      expect(s.borderRadius).toBe(i.borderRadius);
    }
    const fallback = screen.getByRole("button", { name: "date-default" }).element();
    expect(fallback.getAttribute("data-size")).toBe("md");
    expect(fallback.getBoundingClientRect().height).toBe(40);
  });

  it("shows a solid 1px ring outline on Tab focus and none before; pointer cursor", async () => {
    await render(<Picker />);
    const trigger = triggerEl();
    expect(getComputedStyle(trigger).outlineStyle).toBe("none");
    expect(getComputedStyle(trigger).cursor).toBe("pointer");
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger);
    const style = getComputedStyle(trigger);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("1px");
  });

  it("in forced colors: no outline until focused, then a Highlight ring", async () => {
    await render(<Picker />);
    await emulateForcedColors(true);
    const trigger = triggerEl();
    expect(getComputedStyle(trigger).outlineStyle).toBe("none");
    await userEvent.tab();
    const style = getComputedStyle(trigger);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineColor).toBe(systemColor("Highlight"));
  });

  it("is disabled: not-allowed cursor, never opens", async () => {
    await render(<Picker disabled />);
    const trigger = triggerEl();
    expect(trigger.disabled).toBe(true);
    expect(getComputedStyle(trigger).cursor).toBe("not-allowed");
    await userEvent.click(trigger, { force: true });
    await expect.element(dialog()).not.toBeInTheDocument();
  });
});

describe("DatePicker: popup", () => {
  it("opens a dialog named 'Choose date' holding a calendar, with focus on the selected day", async () => {
    await render(<Picker defaultValue={d(2026, 3, 10)} />);
    const element = await open();
    await expect.element(dialog()).toHaveAccessibleName("Choose date");
    expect(element.querySelector("[data-slot=calendar]")).not.toBeNull();
    await expect.element(page.getByRole("grid", { name: "March 2026" })).toBeVisible();
    await expect.poll(focusedDayLabel).toBe(fullDate(d(2026, 3, 10)));
    await expect.element(page.getByRole("button", { name: "Due date" })).not.toBeInTheDocument();
    expect(triggerEl().getAttribute("aria-expanded")).toBe("true");
  });

  it("opens on today's month with focus on today when empty", async () => {
    await render(<Picker />);
    await open();
    await expect.element(page.getByRole("grid", { name: "September 2026" })).toBeVisible();
    await expect.poll(focusedDayLabel).toBe(fullDate(d(2026, 9, 25)));
  });

  it("opens from the keyboard (Enter) and picks a day with the arrows and Enter: closes, focus returns, value shown", async () => {
    const onValueChange = vi.fn();
    await render(<Picker onValueChange={onValueChange} />);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await expect.element(dialog()).toBeVisible();
    await expect.poll(focusedDayLabel).toBe(fullDate(d(2026, 9, 25)));
    await userEvent.keyboard("{ArrowRight}{Enter}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(triggerEl());
    expect(triggerEl().textContent).toBe("Sep 26, 2026");
    expect(triggerEl().hasAttribute("data-placeholder")).toBe(false);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toEqual(d(2026, 9, 26));
  });

  it("picks a day by click", async () => {
    await render(<Picker />);
    await open();
    await userEvent.click(dayButton(d(2026, 9, 3)));
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(triggerEl().textContent).toBe(medium(d(2026, 9, 3)));
    await expect.poll(() => document.activeElement).toBe(triggerEl());
  });

  it("Escape closes without changing the value and returns focus to the trigger", async () => {
    const onValueChange = vi.fn();
    await render(<Picker defaultValue={d(2026, 9, 10)} onValueChange={onValueChange} />);
    await open();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(triggerEl());
    expect(triggerEl().textContent).toBe("Sep 10, 2026");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it.each([
    ["PageDown", "{PageDown}", d(2026, 10, 25), "October 2026"],
    ["PageUp", "{PageUp}", d(2026, 8, 25), "August 2026"],
    ["ArrowRight across the month end", "{ArrowRight}", d(2026, 10, 1), "October 2026"],
  ])(
    "stays open with focus on a day when %s changes the month",
    async (_, key, expected, caption) => {
      const onOpenChange = vi.fn();
      const start = key === "{ArrowRight}" ? d(2026, 9, 30) : d(2026, 9, 25);
      await render(<Picker defaultValue={start} onOpenChange={onOpenChange} />);
      await open();
      await expect.poll(focusedDayLabel).toBe(fullDate(start));
      onOpenChange.mockClear();
      // Where focus is synchronously after the calendar handled the key (window bubble phase, after
      // React's root listener) and in the next frame, before paint.
      const seen: (string | null)[] = [];
      const record = (event: KeyboardEvent) => {
        if (event.key === "Shift") return;
        seen.push(focusedDayLabel());
        requestAnimationFrame(() => seen.push(focusedDayLabel()));
      };
      window.addEventListener("keydown", record);
      try {
        await userEvent.keyboard(key);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      } finally {
        window.removeEventListener("keydown", record);
      }
      expect(seen).toEqual([fullDate(expected), fullDate(expected)]);
      // Right after the keypress settles: focus never fell to <body>, so the popover stayed open.
      expect(focusedDayLabel()).toBe(fullDate(expected));
      expect(popup()?.contains(document.activeElement)).toBe(true);
      await expect.element(page.getByRole("grid", { name: caption })).toBeVisible();
      // Give a focus-out close a chance to land before asserting it didn't.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      expect(onOpenChange).not.toHaveBeenCalledWith(false, expect.anything());
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      await expect.element(dialog()).toBeVisible();
      expect(focusedDayLabel()).toBe(fullDate(expected));
    },
  );

  it("shows the value's month on every open, even after the value changed while closed (controlled)", async () => {
    function Controlled() {
      const [value, setValue] = useState<Date | null>(d(2026, 9, 10));
      return (
        <div className="p-16">
          <button type="button" onClick={() => setValue(d(2027, 1, 15))}>
            Next year
          </button>
          <DatePicker aria-label="Due date" locale="en-US" value={value} onValueChange={setValue} />
        </div>
      );
    }
    await render(<Controlled />);
    await open();
    await expect.element(page.getByRole("grid", { name: "September 2026" })).toBeVisible();
    // Browse away, then close without picking.
    await userEvent.keyboard("{PageDown}{PageDown}");
    await expect.element(page.getByRole("grid", { name: "November 2026" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "Next year" }));
    expect(triggerEl().textContent).toBe("Jan 15, 2027");
    await open();
    await expect.element(page.getByRole("grid", { name: "January 2027" })).toBeVisible();
    await expect.poll(focusedDayLabel).toBe(fullDate(d(2027, 1, 15)));
  });

  it("passes min / max / isDateDisabled / weekStartsOn to the calendar", async () => {
    await render(
      <Picker
        min={d(2026, 9, 5)}
        max={d(2026, 9, 28)}
        isDateDisabled={(date) => date.getDay() === 0}
        weekStartsOn={1}
      />,
    );
    await open();
    await expect.element(dayButton(d(2026, 9, 4))).toHaveAttribute("aria-disabled", "true");
    await expect.element(dayButton(d(2026, 9, 29))).toHaveAttribute("aria-disabled", "true");
    await expect.element(dayButton(d(2026, 9, 13))).toHaveAttribute("aria-disabled", "true");
    await expect.element(dayButton(d(2026, 9, 14))).not.toHaveAttribute("aria-disabled");
    const first = document.querySelector("[data-slot=calendar-weekday]") as HTMLElement;
    expect(first.getAttribute("abbr")).toBe("Monday");
  });

  it("supports a controlled open state", async () => {
    function Controlled() {
      const [isOpen, setOpen] = useState(false);
      return (
        <div className="p-16">
          <span data-testid="state">{isOpen ? "open" : "closed"}</span>
          <DatePicker aria-label="Due date" open={isOpen} onOpenChange={setOpen} />
        </div>
      );
    }
    const screen = await render(<Controlled />);
    await open();
    await expect.element(screen.getByTestId("state")).toHaveTextContent("open");
    await userEvent.click(dayButton(d(2026, 9, 2)));
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.element(screen.getByTestId("state")).toHaveTextContent("closed");
  });

  it("works inside a modal Dialog: Escape closes only the calendar, then the dialog", async () => {
    await render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Schedule</DialogTitle>
          <Field>
            <FieldLabel>Publish on</FieldLabel>
            <DatePicker locale="en-US" />
          </Field>
        </DialogContent>
      </Dialog>,
    );
    const outer = page.getByRole("dialog", { name: "Schedule" });
    await expect.element(outer).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Publish on" }));
    const calendar = page.getByRole("dialog", { name: "Choose date" });
    await expect.element(calendar).toBeVisible();
    await expect.poll(focusedDayLabel).toBe(fullDate(d(2026, 9, 25)));
    await userEvent.keyboard("{Escape}");
    await expect.element(calendar).not.toBeInTheDocument();
    await expect.element(outer).toBeVisible();
    await expect.poll(() => document.activeElement).toBe(triggerEl());
    await userEvent.keyboard("{Escape}");
    await expect.element(outer).not.toBeInTheDocument();
  });

  it("Escape in the month or year view steps back to the days and keeps the popover open; the next Escape closes it", async () => {
    const onOpenChange = vi.fn();
    await render(<Picker defaultValue={d(2026, 9, 10)} onOpenChange={onOpenChange} />);
    await open();
    await expect.poll(focusedDayLabel).toBe(fullDate(d(2026, 9, 10)));
    onOpenChange.mockClear();
    for (const name of ["Choose month, September 2026", "Choose year, 2026"]) {
      await userEvent.click(page.getByRole("button", { name }));
      await expect.element(page.getByRole("grid", { name: /^(Months|Years)/ })).toBeVisible();
      await userEvent.keyboard("{Escape}");
      await expect.element(page.getByRole("grid", { name: "September 2026" })).toBeVisible();
      await expect.poll(focusedDayLabel).toBe(fullDate(d(2026, 9, 10)));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await expect.element(dialog()).toBeVisible();
      expect(onOpenChange).not.toHaveBeenCalled();
    }
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await expect.poll(() => document.activeElement).toBe(triggerEl());
  });

  it("picks a far-away date through the year and month views, the popup staying put", async () => {
    const onValueChange = vi.fn();
    await render(<Picker onValueChange={onValueChange} />);
    const element = await open();
    const before = element.getBoundingClientRect();
    await userEvent.click(page.getByRole("button", { name: "Choose year, 2026" }));
    const years = element.getBoundingClientRect();
    await userEvent.click(page.getByRole("button", { name: "Previous 12 years" }));
    await userEvent.click(page.getByRole("button", { name: "Previous 12 years" }));
    await userEvent.click(page.getByRole("button", { name: "1994", exact: true }));
    const months = element.getBoundingClientRect();
    for (const box of [years, months]) {
      expect(Math.abs(box.left - before.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.top - before.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.width - before.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.height - before.height)).toBeLessThanOrEqual(1);
    }
    await userEvent.click(page.getByRole("button", { name: "June 1994", exact: true }));
    await expect.element(page.getByRole("grid", { name: "June 1994" })).toBeVisible();
    await expect.element(dialog()).toBeVisible();
    await expect.poll(focusedDayLabel).toBe(fullDate(d(1994, 6, 25)));
    await userEvent.keyboard("{Enter}");
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(onValueChange).toHaveBeenCalledWith(d(1994, 6, 25));
    expect(triggerEl().textContent).toBe("Jun 25, 1994");
  });

  it("opens on defaultMonth while empty (a birthday picker), and on the value's month once picked", async () => {
    await render(<Picker defaultMonth={d(1990, 5, 1)} />);
    await open();
    await expect.element(page.getByRole("grid", { name: "May 1990" })).toBeVisible();
    await expect.poll(focusedDayLabel).toBe(fullDate(d(1990, 5, 1)));
    await userEvent.click(dayButton(d(1990, 5, 12)));
    await expect.element(dialog()).not.toBeInTheDocument();
    await open();
    await expect.element(page.getByRole("grid", { name: "May 1990" })).toBeVisible();
    await expect.poll(focusedDayLabel).toBe(fullDate(d(1990, 5, 12)));
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations open in the month view (%s)",
    async (theme) => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(
        <div className="bg-background p-16">
          <DatePicker aria-label="Due date" locale="en-US" defaultValue={d(2026, 9, 25)} />
        </div>,
      );
      await open();
      await userEvent.click(page.getByRole("button", { name: "Choose month, September 2026" }));
      await expect.element(page.getByRole("grid", { name: "Months, 2026" })).toBeVisible();
      const opened = await auditOpenOverlay();
      expect(opened.violations).toEqual([]);
      expect(opened.incomplete).toEqual([]);
    },
  );

  it("translates the dialog and month-button labels via `labels`", async () => {
    await render(
      <Picker
        labels={{ dialog: "Datum wählen", previousMonth: "Vorheriger", nextMonth: "Nächster" }}
      />,
    );
    await open();
    await expect.element(dialog()).toHaveAccessibleName("Datum wählen");
    await expect.element(page.getByRole("button", { name: "Vorheriger" })).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Nächster" })).toBeInTheDocument();
  });
});

describe("DatePicker: forms and Field", () => {
  async function submit(ui: React.ReactNode) {
    let data: FormData | null = null;
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        {ui}
        <button type="submit">Save</button>
      </form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => data).not.toBeNull();
    return data as unknown as FormData;
  }

  it("submits the ISO date through a hidden input", async () => {
    const data = await submit(
      <DatePicker aria-label="Due" name="due" defaultValue={d(2026, 9, 5)} />,
    );
    expect(data.get("due")).toBe("2026-09-05");
  });

  it("submits an empty string when unset", async () => {
    const data = await submit(<DatePicker aria-label="Due" name="due" />);
    expect(data.get("due")).toBe("");
  });

  it("in Field: the label (plus the value) names the trigger, the description describes it, invalid shows the danger border", async () => {
    const screen = await render(
      <div className="p-16">
        <Field invalid>
          <FieldLabel>Due date</FieldLabel>
          <DatePicker locale="en-US" defaultValue={d(2026, 9, 25)} />
          <FieldDescription>When the invoice is due.</FieldDescription>
        </Field>
        <div data-testid="ref" className="border border-danger" />
      </div>,
    );
    const trigger = page.getByRole("button", { name: "Due date Sep 25, 2026", exact: true });
    await expect.element(trigger).toBeInTheDocument();
    await expect.element(trigger).toHaveAccessibleDescription("When the invoice is due.");
    await expect.element(trigger).toHaveAttribute("data-invalid");
    await expect.element(trigger).toHaveAttribute("aria-invalid", "true");
    expect(getComputedStyle(trigger.element()).borderTopColor).toBe(
      getComputedStyle(screen.getByTestId("ref").element()).borderTopColor,
    );
    // The label is a native <label for> the trigger: clicking it activates the trigger (as with Select).
    const label = document.querySelector("[data-slot=field-label]") as HTMLLabelElement;
    expect(label.htmlFor).toBe(trigger.element().id);
    await userEvent.click(label);
    await expect.element(dialog()).toBeVisible();
  });

  it("in Field: an empty value leaves the label alone as the name", async () => {
    await render(
      <Field>
        <FieldLabel>Due date</FieldLabel>
        <DatePicker />
      </Field>,
    );
    await expect
      .element(page.getByRole("button", { name: "Due date", exact: true }))
      .toBeInTheDocument();
  });

  it("in a disabled Field: disabled and never opens", async () => {
    await render(
      <Field disabled>
        <FieldLabel>Due date</FieldLabel>
        <DatePicker />
      </Field>,
    );
    const trigger = triggerEl();
    expect(trigger.disabled).toBe(true);
    expect(trigger.hasAttribute("data-disabled")).toBe(true);
    await userEvent.click(trigger, { force: true });
    await expect.element(dialog()).not.toBeInTheDocument();
  });
});

describe("DatePicker: structure and accessibility", () => {
  it("sets data-slot on every part and merges className", async () => {
    const screen = await render(
      <div className="p-16">
        <DatePicker aria-label="Due" className="w-64" />
      </div>,
    );
    const trigger = triggerEl();
    expect(trigger.classList.contains("w-64")).toBe(true);
    expect(trigger.classList.contains("w-full")).toBe(false);
    expect(trigger.querySelector("[data-slot=date-picker-icon]")).not.toBeNull();
    expect(trigger.querySelector("[data-slot=date-picker-value]")).not.toBeNull();
    const element = await open();
    expect(screen.container.contains(element)).toBe(false);
    expect(element.getAttribute("data-slot")).toBe("date-picker-content");
    expect(element.classList.contains("p-0")).toBe(true);
    expect(element.classList.contains("p-4")).toBe(false);
    expect(element.classList.contains("w-auto")).toBe(true);
    expect(element.classList.contains("w-72")).toBe(false);
    // Start-aligned, 6px below the trigger.
    const t = trigger.getBoundingClientRect();
    const p = element.getBoundingClientRect();
    expect(Math.abs(p.left - t.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(p.top - t.bottom - 6)).toBeLessThanOrEqual(1);
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations closed and open (%s)",
    async (theme) => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(
        // The placeholder picker sits above, so the open popup (below the other) doesn't cover it.
        <div className="bg-background p-16">
          <DatePicker aria-label="Start" locale="en-US" />
          <Field>
            <FieldLabel>Due date</FieldLabel>
            <DatePicker locale="en-US" defaultValue={d(2026, 9, 25)} />
          </Field>
        </div>,
      );
      const closed = await auditOpenOverlay();
      expect(closed.violations).toEqual([]);
      expect(closed.incomplete).toEqual([]);
      await userEvent.click(page.getByRole("button", { name: "Due date Sep 25, 2026" }));
      await expect.element(dialog()).toBeVisible();
      await waitForPopupSettled(popup() as HTMLElement);
      const opened = await auditOpenOverlay();
      expect(opened.violations).toEqual([]);
      expect(opened.incomplete).toEqual([]);
    },
  );
});

describe("DateRangePicker", () => {
  function Range(props: React.ComponentProps<typeof DateRangePicker>) {
    return (
      <div className="p-16">
        <DateRangePicker aria-label="Stay" locale="en-US" {...props} />
      </div>
    );
  }
  const rangeText = (start: Date, end: Date) =>
    new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).formatRange(start, end);

  it("shows 'Pick a date range' when empty and the formatRange text when set", async () => {
    const screen = await render(
      <div className="flex flex-col gap-2">
        <DateRangePicker aria-label="A" locale="en-US" />
        <DateRangePicker
          aria-label="B"
          locale="en-US"
          defaultValue={{ start: d(2026, 9, 1), end: d(2026, 9, 12) }}
        />
      </div>,
    );
    const triggers = screen.container.querySelectorAll("[data-slot=date-picker-trigger]");
    expect(triggers[0]?.textContent).toBe("Pick a date range");
    expect(triggers[0]?.hasAttribute("data-placeholder")).toBe(true);
    expect(triggers[1]?.textContent).toBe(rangeText(d(2026, 9, 1), d(2026, 9, 12)));
    expect(triggers[1]?.textContent).toBe("Sep 1 – 12, 2026");
    await expect
      .element(page.getByRole("button", { name: "B Sep 1 – 12, 2026", exact: true }))
      .toBeInTheDocument();
  });

  it("opens two months named 'Choose date range', focus on the range start", async () => {
    await render(<Range defaultValue={{ start: d(2026, 9, 1), end: d(2026, 9, 12) }} />);
    await open();
    await expect.element(dialog()).toHaveAccessibleName("Choose date range");
    await expect.element(page.getByRole("grid", { name: "September 2026" })).toBeVisible();
    await expect.element(page.getByRole("grid", { name: "October 2026" })).toBeVisible();
    await expect.poll(focusedDayLabel).toBe(fullDate(d(2026, 9, 1)));
  });

  it("stays open after the start, closes after the end, and reports only the complete range", async () => {
    const onValueChange = vi.fn();
    await render(<Range onValueChange={onValueChange} />);
    await open();
    await userEvent.click(dayButton(d(2026, 9, 28)));
    await expect.element(dialog()).toBeVisible();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(triggerEl().textContent).toBe("Pick a date range");
    await userEvent.click(dayButton(d(2026, 10, 3)));
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toEqual({
      start: d(2026, 9, 28),
      end: d(2026, 10, 3),
    });
    expect(triggerEl().textContent).toBe(rangeText(d(2026, 9, 28), d(2026, 10, 3)));
    await expect.poll(() => document.activeElement).toBe(triggerEl());
  });

  it("picks a range with the keyboard", async () => {
    const onValueChange = vi.fn();
    await render(<Range onValueChange={onValueChange} />);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await expect.poll(focusedDayLabel).toBe(fullDate(d(2026, 9, 25)));
    await userEvent.keyboard("{Enter}{ArrowDown}{Enter}");
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(onValueChange.mock.calls[0]?.[0]).toEqual({
      start: d(2026, 9, 25),
      end: d(2026, 10, 2),
    });
    await expect.poll(() => document.activeElement).toBe(triggerEl());
  });

  it("Escape in a month or year view keeps the popover open and the half-chosen range; the next Escape reverts", async () => {
    const onOpenChange = vi.fn();
    const onValueChange = vi.fn();
    const committed = { start: d(2026, 9, 1), end: d(2026, 9, 12) };
    await render(
      <Range defaultValue={committed} onOpenChange={onOpenChange} onValueChange={onValueChange} />,
    );
    await open();
    await userEvent.click(dayButton(d(2026, 9, 20)));
    await expect.element(dayButton(d(2026, 9, 20))).toHaveAttribute("data-range-start");
    onOpenChange.mockClear();
    for (const name of ["Choose month, October 2026", "Choose year, 2026"]) {
      await userEvent.click(page.getByRole("button", { name }).last());
      await expect.element(page.getByRole("grid", { name: /^(Months|Years)/ })).toBeVisible();
      await userEvent.keyboard("{Escape}");
      await expect.element(page.getByRole("grid", { name: "October 2026" })).toBeVisible();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await expect.element(dialog()).toBeVisible();
      expect(onOpenChange).not.toHaveBeenCalled();
      await expect.element(dayButton(d(2026, 9, 20))).toHaveAttribute("data-range-start");
    }
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(triggerEl().textContent).toBe(rangeText(committed.start, committed.end));
  });

  it("reverts on Escape with only the start chosen", async () => {
    const onValueChange = vi.fn();
    const committed = { start: d(2026, 9, 1), end: d(2026, 9, 12) };
    await render(<Range defaultValue={committed} onValueChange={onValueChange} />);
    await open();
    await userEvent.click(dayButton(d(2026, 9, 20)));
    await expect.element(dayButton(d(2026, 9, 20))).toHaveAttribute("data-range-start");
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(triggerEl().textContent).toBe(rangeText(committed.start, committed.end));
    // Reopening shows the committed range again, not the abandoned start.
    await open();
    await expect.element(dayButton(d(2026, 9, 1))).toHaveAttribute("data-range-start");
    await expect.element(dayButton(d(2026, 9, 12))).toHaveAttribute("data-range-end");
    await expect.element(dayButton(d(2026, 9, 20))).not.toHaveAttribute("data-range-start");
  });

  describe("controlled open", () => {
    /**
     * A parent that refuses every close request; it closes the picker only by itself
     * (`closeFromParent`, no close request involved).
     */
    let closeFromParent = () => {};
    function Gatekeeper({ onValueChange }: { onValueChange?: (range: DateRange) => void }) {
      const [isOpen, setOpen] = useState(false);
      closeFromParent = () => setOpen(false);
      return (
        <div className="p-16">
          <DateRangePicker
            aria-label="Stay"
            locale="en-US"
            defaultValue={{ start: d(2026, 9, 1), end: d(2026, 9, 12) }}
            open={isOpen}
            onOpenChange={(next) => {
              if (next) setOpen(true);
            }}
            onValueChange={onValueChange}
          />
        </div>
      );
    }

    it("drops the draft when the parent closes it by setting open={false}", async () => {
      const onValueChange = vi.fn();
      await render(<Gatekeeper onValueChange={onValueChange} />);
      await open();
      await userEvent.click(dayButton(d(2026, 9, 20)));
      await expect.element(dayButton(d(2026, 9, 20))).toHaveAttribute("data-range-start");
      closeFromParent();
      await expect.element(dialog()).not.toBeInTheDocument();
      await open();
      await expect.element(dayButton(d(2026, 9, 1))).toHaveAttribute("data-range-start");
      await expect.element(dayButton(d(2026, 9, 12))).toHaveAttribute("data-range-end");
      await expect.element(dayButton(d(2026, 9, 20))).not.toHaveAttribute("data-range-start");
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("keeps the draft while the parent refuses a close", async () => {
      const onValueChange = vi.fn();
      await render(<Gatekeeper onValueChange={onValueChange} />);
      await open();
      await userEvent.click(dayButton(d(2026, 9, 20)));
      await userEvent.keyboard("{Escape}");
      // Refused: still open, the start still chosen; the next pick completes the range.
      await expect.element(dialog()).toBeVisible();
      await expect.element(dayButton(d(2026, 9, 20))).toHaveAttribute("data-range-start");
      await userEvent.click(dayButton(d(2026, 9, 23)));
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]?.[0]).toEqual({
        start: d(2026, 9, 20),
        end: d(2026, 9, 23),
      });
    });
  });

  it("reverts on an outside click with only the start chosen", async () => {
    const onValueChange = vi.fn();
    await render(
      <div>
        <button type="button">Outside</button>
        <Range onValueChange={onValueChange} />
      </div>,
    );
    await open();
    await userEvent.click(dayButton(d(2026, 9, 20)));
    await userEvent.click(page.getByRole("button", { name: "Outside" }));
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(triggerEl().textContent).toBe("Pick a date range");
    await open();
    await expect.element(dayButton(d(2026, 9, 20))).not.toHaveAttribute("data-range-start");
  });

  it("follows a controlled value and supports numberOfMonths={1}", async () => {
    function Controlled() {
      const [value, setValue] = useState<DateRange>({ start: null, end: null });
      return (
        <div className="p-16">
          <span data-testid="out">
            {value.start && value.end ? `${value.start.getDate()}-${value.end.getDate()}` : "none"}
          </span>
          <DateRangePicker
            aria-label="Stay"
            locale="en-US"
            numberOfMonths={1}
            value={value}
            onValueChange={setValue}
          />
        </div>
      );
    }
    const screen = await render(<Controlled />);
    await open();
    expect(document.querySelectorAll("[data-slot=calendar-grid]")).toHaveLength(1);
    await userEvent.click(dayButton(d(2026, 9, 12)));
    await userEvent.click(dayButton(d(2026, 9, 4)));
    await expect.element(screen.getByTestId("out")).toHaveTextContent("4-12");
    expect(triggerEl().textContent).toBe(rangeText(d(2026, 9, 4), d(2026, 9, 12)));
  });

  it("submits both ends as ISO dates, and empty strings when unset", async () => {
    let data: FormData | null = null;
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <DateRangePicker
          aria-label="Stay"
          startName="from"
          endName="to"
          defaultValue={{ start: d(2026, 9, 1), end: d(2026, 9, 12) }}
        />
        <DateRangePicker aria-label="Empty" startName="a" endName="b" />
        <button type="submit">Save</button>
      </form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => data).not.toBeNull();
    const form = data as unknown as FormData;
    expect(form.get("from")).toBe("2026-09-01");
    expect(form.get("to")).toBe("2026-09-12");
    expect(form.get("a")).toBe("");
    expect(form.get("b")).toBe("");
  });

  it("in Field: the label plus the range names the trigger", async () => {
    await render(
      <Field>
        <FieldLabel>Embargo</FieldLabel>
        <DateRangePicker
          locale="en-US"
          defaultValue={{ start: d(2026, 9, 1), end: d(2026, 10, 12) }}
        />
      </Field>,
    );
    await expect
      .element(page.getByRole("button", { name: "Embargo Sep 1 – Oct 12, 2026", exact: true }))
      .toBeInTheDocument();
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations closed and open (%s)",
    async (theme) => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(
        <div className="bg-background p-16">
          <Field>
            <FieldLabel>Embargo</FieldLabel>
            <DateRangePicker
              locale="en-US"
              defaultValue={{ start: d(2026, 9, 1), end: d(2026, 9, 12) }}
            />
          </Field>
        </div>,
      );
      const closed = await auditOpenOverlay();
      expect(closed.violations).toEqual([]);
      expect(closed.incomplete).toEqual([]);
      await open();
      // Mid-selection: a start plus a hover preview.
      await userEvent.click(dayButton(d(2026, 9, 20)));
      await userEvent.hover(dayButton(d(2026, 9, 24)));
      const opened = await auditOpenOverlay();
      expect(opened.violations).toEqual([]);
      expect(opened.incomplete).toEqual([]);
    },
  );
});
