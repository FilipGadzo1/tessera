import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, systemColor } from "../../../test/emulation";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { Button } from "../button";
import type { DateRange } from "../calendar";
import { Field, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import { Input } from "../input";
import { DateRangePicker, type DateRangePickerEditableProps } from "./date-picker";

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
const range = (start: Date | null, end: Date | null): DateRange => ({ start, end });
const fullDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(date);

const dialog = () => page.getByRole("dialog");
const popup = () => document.querySelector<HTMLElement>("[data-slot=date-picker-content]");
const dayButton = (date: Date) => page.getByRole("button", { name: fullDate(date), exact: true });
const iconButton = () =>
  document.querySelector<HTMLButtonElement>("[data-slot=date-picker-trigger]") as HTMLButtonElement;
const field = () =>
  document.querySelector<HTMLElement>("[data-slot=date-range-field]") as HTMLElement;
const seg = (half: "start" | "end", type: "day" | "month" | "year") =>
  document.querySelector<HTMLElement>(
    `[data-slot=date-range-field-${half}] [data-slot=date-field-segment][data-type=${type}]`,
  ) as HTMLElement;
const texts = (half: "start" | "end") =>
  [
    ...document.querySelectorAll(
      `[data-slot=date-range-field-${half}] [data-slot=date-field-segment]`,
    ),
  ].map((s) => s.textContent);
const focusedDayLabel = () =>
  document.activeElement?.getAttribute("data-slot") === "calendar-day"
    ? document.activeElement.getAttribute("aria-label")
    : null;

/** Sends one key at a time: focus may move between segments after each. */
async function type(keys: string) {
  for (const key of keys) await userEvent.keyboard(key);
}

async function openCalendar() {
  await userEvent.click(iconButton());
  await expect.element(dialog()).toBeVisible();
  const element = popup() as HTMLElement;
  await waitForPopupSettled(element);
  return element;
}

function Editable(props: Omit<DateRangePickerEditableProps, "editable">) {
  // Padding leaves room on every side, so the popup never flips; 20rem inside fits both dates
  // and the icon button.
  return (
    <div className="w-[28rem] p-16">
      <DateRangePicker editable aria-label="Stay" locale="en-US" {...props} />
    </div>
  );
}

describe("DateRangePicker: editable", () => {
  it("renders a DateRangeField and a calendar icon button inside its border, and no trigger text", async () => {
    await render(<Editable />);
    await expect
      .element(page.getByRole("group", { name: "Stay", exact: true }))
      .toBeInTheDocument();
    expect(texts("start")).toEqual(["mm", "dd", "yyyy"]);
    expect(texts("end")).toEqual(["mm", "dd", "yyyy"]);
    const button = iconButton();
    expect(button.type).toBe("button");
    expect(button.getAttribute("aria-label")).toBe("Choose date range");
    expect(document.querySelector("[data-slot=date-picker-value]")).toBeNull();
    const box = field().getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    expect(rect.right).toBeLessThanOrEqual(box.right);
    expect(rect.left).toBeGreaterThan(seg("end", "year").getBoundingClientRect().right);
    expect(rect.top).toBeGreaterThanOrEqual(box.top);
    expect(rect.bottom).toBeLessThanOrEqual(box.bottom);
  });

  it("under dir=rtl, the icon button sits at the inline end (left), clear of the segments", async () => {
    await render(
      <div dir="rtl">
        <Editable />
      </div>,
    );
    const box = field().getBoundingClientRect();
    const rect = iconButton().getBoundingClientRect();
    expect(rect.left).toBeGreaterThanOrEqual(box.left);
    expect(rect.right).toBeLessThan(seg("end", "year").getBoundingClientRect().left);
  });

  it("in a container narrower than it, the field grows: the border wraps the segments and the button", async () => {
    await render(
      <div className="w-40 p-16">
        <DateRangePicker
          editable
          aria-label="Stay"
          locale="en-US"
          size="lg"
          defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))}
        />
      </div>,
    );
    const box = field().getBoundingClientRect();
    const rect = iconButton().getBoundingClientRect();
    expect(rect.right).toBeLessThanOrEqual(box.right);
    expect(rect.left).toBeGreaterThan(seg("end", "year").getBoundingClientRect().right);
  });

  it("is not editable by default: the button trigger", async () => {
    await render(<DateRangePicker aria-label="Stay" locale="en-US" />);
    expect(document.querySelector("[data-slot=date-range-field]")).toBeNull();
    expect(document.querySelector("[data-slot=date-picker-value]")).not.toBeNull();
  });

  it("localises the button, the dialog and the halves through labels", async () => {
    await render(
      <Editable
        labels={{
          openCalendar: "Zeitraum wählen",
          dialog: "Zeitraum",
          start: "Anreise",
          end: "Abreise",
        }}
      />,
    );
    await expect
      .element(page.getByRole("button", { name: "Zeitraum wählen", exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("group", { name: "Anreise Stay", exact: true }))
      .toBeInTheDocument();
    await openCalendar();
    await expect.element(page.getByRole("dialog", { name: "Zeitraum" })).toBeVisible();
  });

  it("typing a complete range reports it while closed; opening shows it selected, on the start's month", async () => {
    const onValueChange = vi.fn();
    await render(<Editable onValueChange={onValueChange} />);
    await userEvent.click(seg("start", "month"));
    await type("03152027");
    await type("03182027");
    expect(onValueChange).toHaveBeenLastCalledWith(range(d(2027, 3, 15), d(2027, 3, 18)));
    await expect.element(dialog()).not.toBeInTheDocument();
    await openCalendar();
    await expect.element(page.getByText("March 2027")).toBeVisible();
    for (const day of [15, 16, 17, 18]) {
      const cell = dayButton(d(2027, 3, day))
        .element()
        .closest("[role=gridcell]");
      expect(cell?.getAttribute("aria-selected"), String(day)).toBe("true");
    }
    await expect.poll(focusedDayLabel).toBe(fullDate(d(2027, 3, 15)));
  });

  it("picking fills both halves, closes, and returns focus to the icon button", async () => {
    const onValueChange = vi.fn();
    await render(<Editable onValueChange={onValueChange} />);
    await openCalendar();
    await userEvent.click(dayButton(d(2026, 9, 8)));
    // The first pick is a draft: still open, nothing reported, the halves unchanged.
    await expect.element(dialog()).toBeVisible();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(texts("start")).toEqual(["mm", "dd", "yyyy"]);
    await userEvent.click(dayButton(d(2026, 9, 10)));
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(texts("start")).toEqual(["09", "08", "2026"]);
    expect(texts("end")).toEqual(["09", "10", "2026"]);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(range(d(2026, 9, 8), d(2026, 9, 10)));
    await expect.poll(() => document.activeElement).toBe(iconButton());
  });

  it("a typed start plus one click picks the end (an earlier click swaps)", async () => {
    const onValueChange = vi.fn();
    await render(<Editable onValueChange={onValueChange} />);
    await userEvent.click(seg("start", "month"));
    await type("09082026");
    expect(onValueChange).toHaveBeenLastCalledWith(range(d(2026, 9, 8), null));
    await openCalendar();
    await userEvent.click(dayButton(d(2026, 9, 12)));
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(texts("start")).toEqual(["09", "08", "2026"]);
    expect(texts("end")).toEqual(["09", "12", "2026"]);
    expect(onValueChange).toHaveBeenLastCalledWith(range(d(2026, 9, 8), d(2026, 9, 12)));
    await expect.poll(() => document.activeElement).toBe(iconButton());
    // Only the start again, then an earlier day: the ends swap.
    await userEvent.click(seg("end", "day"));
    await userEvent.keyboard("{Backspace}");
    expect(onValueChange).toHaveBeenLastCalledWith(range(d(2026, 9, 8), null));
    await openCalendar();
    await userEvent.click(dayButton(d(2026, 9, 3)));
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(texts("start")).toEqual(["09", "03", "2026"]);
    expect(texts("end")).toEqual(["09", "08", "2026"]);
  });

  it("a reversed typed range draws no band in the calendar; picking two days fills a valid range", async () => {
    const onValueChange = vi.fn();
    await render(
      <Editable
        defaultValue={range(d(2026, 9, 12), d(2026, 9, 1))}
        onValueChange={onValueChange}
      />,
    );
    expect(field().hasAttribute("data-invalid")).toBe(true);
    const element = await openCalendar();
    expect(element.querySelectorAll("[role=gridcell][aria-selected=true]")).toHaveLength(0);
    expect(element.querySelectorAll("[data-selected], [data-range-middle]")).toHaveLength(0);
    // The field still shows the typed (invalid) range.
    expect(field().hasAttribute("data-invalid")).toBe(true);
    await userEvent.click(dayButton(d(2026, 9, 4)));
    await userEvent.click(dayButton(d(2026, 9, 9)));
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(texts("start")).toEqual(["09", "04", "2026"]);
    expect(texts("end")).toEqual(["09", "09", "2026"]);
    expect(onValueChange).toHaveBeenLastCalledWith(range(d(2026, 9, 4), d(2026, 9, 9)));
    expect(field().hasAttribute("data-invalid")).toBe(false);
  });

  it("picking replaces partially typed segments", async () => {
    await render(<Editable />);
    await userEvent.click(seg("end", "month"));
    await type("07");
    await openCalendar();
    await userEvent.click(dayButton(d(2026, 9, 8)));
    await userEvent.click(dayButton(d(2026, 9, 10)));
    await expect.poll(() => texts("end")).toEqual(["09", "10", "2026"]);
  });

  it("Escape with only the start picked reverts, and returns focus to the icon button", async () => {
    const onValueChange = vi.fn();
    await render(
      <Editable
        defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))}
        onValueChange={onValueChange}
      />,
    );
    await openCalendar();
    await userEvent.click(dayButton(d(2026, 9, 20)));
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(iconButton());
    expect(texts("start")).toEqual(["09", "01", "2026"]);
    expect(texts("end")).toEqual(["09", "12", "2026"]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("follows a controlled value", async () => {
    const screen = await render(<Editable value={range(d(2026, 9, 1), d(2026, 9, 12))} />);
    expect(texts("end")).toEqual(["09", "12", "2026"]);
    await screen.rerender(<Editable value={range(d(2026, 10, 1), d(2026, 10, 5))} />);
    expect(texts("start")).toEqual(["10", "01", "2026"]);
    expect(texts("end")).toEqual(["10", "05", "2026"]);
  });

  it("passes min / max to the field and the calendar", async () => {
    await render(
      <Editable defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))} max={d(2026, 9, 10)} />,
    );
    expect(field().hasAttribute("data-invalid")).toBe(true);
    await openCalendar();
    expect(
      dayButton(d(2026, 9, 11))
        .element()
        .getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("types its props per mode: the group's when editable, the button's otherwise", async () => {
    const groupRef = { current: null as HTMLDivElement | null };
    const buttonRef = { current: null as HTMLButtonElement | null };
    const wrongRef = { current: null as HTMLButtonElement | null };
    await render(
      <div className="p-16">
        <DateRangePicker editable ref={groupRef} aria-label="Typed" locale="en-US" />
        <DateRangePicker ref={buttonRef} aria-label="Button" locale="en-US" />
        {/* @ts-expect-error -- an editable picker's ref is the group element, not a button. */}
        <DateRangePicker editable ref={wrongRef} aria-label="Wrong" locale="en-US" />
      </div>,
    );
    expect(groupRef.current?.getAttribute("data-slot")).toBe("date-range-field");
    expect(buttonRef.current?.tagName).toBe("BUTTON");
  });

  it("readOnly keeps the segments focusable and disables the icon button; disabled disables both", async () => {
    const screen = await render(<Editable readOnly defaultValue={range(d(2026, 9, 1), null)} />);
    expect(iconButton().disabled).toBe(true);
    await userEvent.click(seg("start", "month"));
    expect(document.activeElement).toBe(seg("start", "month"));
    await screen.rerender(<Editable disabled />);
    expect(iconButton().disabled).toBe(true);
    expect(field().hasAttribute("data-disabled")).toBe(true);
  });

  it("sits at the Input heights per size with the button inside the border", async () => {
    await render(
      <div className="flex flex-col gap-2">
        {(["sm", "md", "lg"] as const).map((size) => (
          <div key={size} className="flex gap-2">
            <Input aria-label={`input-${size}`} size={size} />
            <div className="w-96">
              <DateRangePicker editable aria-label={`range-${size}`} size={size} locale="en-US" />
            </div>
          </div>
        ))}
      </div>,
    );
    const heights = { sm: 32, md: 40, lg: 48 };
    for (const size of ["sm", "md", "lg"] as const) {
      const input = page.getByRole("textbox", { name: `input-${size}` }).element();
      const group = page.getByRole("group", { name: `range-${size}`, exact: true }).element();
      const r = group.getBoundingClientRect();
      expect(r.height).toBe(heights[size]);
      const i = getComputedStyle(input);
      expect(getComputedStyle(group).paddingLeft).toBe(i.paddingLeft);
      const text = document.createRange();
      text.selectNodeContents(group.querySelector("[data-type=month]")?.firstChild as Node);
      expect(text.getBoundingClientRect().left - r.left).toBeCloseTo(
        Number.parseFloat(i.borderLeftWidth) + Number.parseFloat(i.paddingLeft),
        1,
      );
      const button = (group.parentElement as HTMLElement).querySelector("button") as HTMLElement;
      const b = button.getBoundingClientRect();
      expect(Math.abs(b.top - r.top - (r.bottom - b.bottom))).toBeLessThanOrEqual(1);
      expect(b.right).toBeLessThanOrEqual(r.right);
    }
  });

  it("forced colors: a focused segment is Highlight on HighlightText; the icon button rings Highlight", async () => {
    await render(<Editable />);
    await emulateForcedColors(true);
    await userEvent.click(seg("end", "month"));
    const style = getComputedStyle(seg("end", "month"));
    expect(style.backgroundColor).toBe(systemColor("Highlight"));
    expect(style.color).toBe(systemColor("HighlightText"));
    await userEvent.click(seg("end", "year"));
    await userEvent.tab();
    expect(document.activeElement).toBe(iconButton());
    expect(getComputedStyle(iconButton()).outlineColor).toBe(systemColor("Highlight"));
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations closed and open (%s)",
    async (theme) => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(
        <div className="w-[28rem] bg-background p-16">
          <Field>
            <FieldLabel>Stay</FieldLabel>
            <DateRangePicker
              editable
              locale="en-US"
              defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))}
            />
          </Field>
        </div>,
      );
      const closed = await auditOpenOverlay();
      expect(closed.violations).toEqual([]);
      expect(closed.incomplete).toEqual([]);
      await openCalendar();
      const opened = await auditOpenOverlay();
      expect(opened.violations).toEqual([]);
      expect(opened.incomplete).toEqual([]);
    },
  );
});

describe("DateRangePicker: editable in Field and Form", () => {
  function FormUi(props: {
    onFormSubmit?: (values: unknown) => void;
    required?: boolean;
    validationMode?: "onSubmit" | "onBlur";
  }) {
    return (
      <div className="w-[28rem] p-16">
        <Form
          aria-label="Booking"
          onFormSubmit={props.onFormSubmit ?? (() => {})}
          validationMode={props.validationMode}
        >
          <Field name="stay">
            <FieldLabel>Stay</FieldLabel>
            <DateRangePicker editable locale="en-US" required={props.required} />
            <FieldError />
          </Field>
          <Input aria-label="After" />
          <Button type="submit">Send</Button>
        </Form>
      </div>
    );
  }
  const send = () => userEvent.click(page.getByRole("button", { name: "Send" }));

  it("registers one Field control; the label names the group and clicking it focuses the first segment", async () => {
    await render(<FormUi />);
    expect(document.querySelectorAll("[data-slot=date-form-control]")).toHaveLength(1);
    await expect
      .element(page.getByRole("group", { name: "Stay", exact: true }))
      .toBeInTheDocument();
    await userEvent.click(document.querySelector("[data-slot=field-label]") as HTMLElement);
    expect(document.activeElement).toBe(seg("start", "month"));
  });

  it("required blocks the submit and focuses the first segment; a pick submits { start, end }", async () => {
    const onFormSubmit = vi.fn();
    await render(<FormUi required onFormSubmit={onFormSubmit} />);
    await send();
    await expect.poll(() => document.activeElement).toBe(seg("start", "month"));
    expect(onFormSubmit).not.toHaveBeenCalled();
    await openCalendar();
    await userEvent.click(dayButton(d(2026, 9, 8)));
    await userEvent.click(dayButton(d(2026, 9, 10)));
    await expect.element(dialog()).not.toBeInTheDocument();
    await send();
    await expect.poll(() => onFormSubmit.mock.calls.length).toBe(1);
    expect(onFormSubmit.mock.calls[0]?.[0]).toEqual({
      stay: { start: "2026-09-08", end: "2026-09-10" },
    });
  });

  it("validationMode onBlur: the halves, the icon button and the popup are one boundary", async () => {
    await render(<FormUi validationMode="onBlur" />);
    const incomplete = page.getByText("Enter a complete date range.");
    await userEvent.click(seg("start", "month"));
    await type("09012026");
    // Into the end half, then Tab through it to the icon button: still inside.
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(iconButton());
    await expect.element(incomplete).not.toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    await expect.element(dialog()).toBeVisible();
    await waitForPopupSettled(popup() as HTMLElement);
    await expect.element(incomplete).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => document.activeElement).toBe(iconButton());
    await expect.element(incomplete).not.toBeInTheDocument();
    await userEvent.tab();
    await expect.element(incomplete).toBeVisible();
  });

  it("submits startName / endName through native FormData", async () => {
    let data: FormData | null = null;
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <DateRangePicker
          editable
          aria-label="Stay"
          startName="from"
          endName="to"
          defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))}
        />
        <button type="submit">Save</button>
      </form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => data).not.toBeNull();
    expect(Object.fromEntries((data as unknown as FormData).entries())).toEqual({
      from: "2026-09-01",
      to: "2026-09-12",
    });
  });
});
