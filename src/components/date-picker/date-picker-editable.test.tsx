import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, systemColor } from "../../../test/emulation";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { Button } from "../button";
import { Field, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import { Input } from "../input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";
import { DatePicker, type DatePickerProps } from "./date-picker";

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

const dialog = () => page.getByRole("dialog");
const popup = () => document.querySelector<HTMLElement>("[data-slot=date-picker-content]");
const dayButton = (date: Date) => page.getByRole("button", { name: fullDate(date), exact: true });
const iconButton = () =>
  document.querySelector<HTMLButtonElement>("[data-slot=date-picker-trigger]") as HTMLButtonElement;
const seg = (type: "day" | "month" | "year") =>
  document.querySelector<HTMLElement>(
    `[data-slot=date-field-segment][data-type=${type}]`,
  ) as HTMLElement;
const texts = () =>
  [...document.querySelectorAll("[data-slot=date-field-segment]")].map((s) => s.textContent);
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

function Editable(props: DatePickerProps) {
  // Padding leaves room on every side, so the popup never flips.
  return (
    <div className="p-16">
      <DatePicker editable aria-label="Due date" locale="en-US" {...props} />
    </div>
  );
}

describe("DatePicker: editable", () => {
  it("renders a DateField group and a calendar icon button, and no trigger text", async () => {
    await render(<Editable />);
    await expect.element(page.getByRole("group", { name: "Due date" })).toBeInTheDocument();
    expect(texts()).toEqual(["mm", "dd", "yyyy"]);
    const button = iconButton();
    expect(button.tagName).toBe("BUTTON");
    expect(button.type).toBe("button");
    expect(button.getAttribute("aria-label")).toBe("Choose date");
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelector("[data-slot=date-picker-value]")).toBeNull();
    // The button sits inside the field's border, at its trailing edge.
    const field = (
      document.querySelector("[data-slot=date-field]") as HTMLElement
    ).getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    expect(rect.right).toBeLessThanOrEqual(field.right);
    expect(rect.left).toBeGreaterThan(seg("year").getBoundingClientRect().right);
    expect(rect.top).toBeGreaterThanOrEqual(field.top);
    expect(rect.bottom).toBeLessThanOrEqual(field.bottom);
  });

  it("is not editable by default: no segments", async () => {
    await render(<Editable editable={false} />);
    expect(document.querySelector("[data-slot=date-field]")).toBeNull();
    expect(document.querySelector("[data-slot=date-picker-value]")).not.toBeNull();
  });

  it("shows the value in the segments, and localises the button through labels", async () => {
    await render(
      <Editable
        defaultValue={d(2026, 9, 5)}
        labels={{ openCalendar: "Datum wählen", dialog: "Datum" }}
      />,
    );
    expect(texts()).toEqual(["09", "05", "2026"]);
    await expect
      .element(page.getByRole("button", { name: "Datum wählen", exact: true }))
      .toBeInTheDocument();
  });

  it("typing a complete date reports it while closed; opening shows that month with the day selected", async () => {
    const onValueChange = vi.fn();
    await render(<Editable onValueChange={onValueChange} />);
    await userEvent.click(seg("month"));
    await type("03152027");
    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toEqual(d(2027, 3, 15));
    await expect.element(dialog()).not.toBeInTheDocument();
    await openCalendar();
    await expect.poll(focusedDayLabel).toBe(fullDate(d(2027, 3, 15)));
    await expect.element(page.getByText("March 2027")).toBeVisible();
    const selected = dayButton(d(2027, 3, 15)).element();
    expect(selected.hasAttribute("data-selected")).toBe(true);
    expect(selected.closest("[role=gridcell]")?.getAttribute("aria-selected")).toBe("true");
  });

  it("clearing a segment of a complete date reports null", async () => {
    const onValueChange = vi.fn();
    await render(<Editable defaultValue={d(2026, 9, 5)} onValueChange={onValueChange} />);
    await userEvent.click(seg("day"));
    await userEvent.keyboard("{Backspace}");
    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  it("picking in the calendar fills the segments, closes, and returns focus to the icon button", async () => {
    const onValueChange = vi.fn();
    await render(<Editable onValueChange={onValueChange} />);
    await openCalendar();
    await userEvent.click(dayButton(d(2026, 9, 18)));
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(texts()).toEqual(["09", "18", "2026"]);
    expect(onValueChange).toHaveBeenCalledWith(d(2026, 9, 18));
    await expect.poll(() => document.activeElement).toBe(iconButton());
  });

  it("picking replaces partially typed segments", async () => {
    await render(<Editable />);
    await userEvent.click(seg("month"));
    await type("07");
    await openCalendar();
    await userEvent.click(dayButton(d(2026, 9, 18)));
    await expect.poll(texts).toEqual(["09", "18", "2026"]);
  });

  it("opens from the keyboard: Tab to the button, Enter, arrows and Enter pick", async () => {
    await render(<Editable defaultValue={d(2026, 9, 10)} />);
    await userEvent.click(seg("year"));
    await userEvent.tab();
    expect(document.activeElement).toBe(iconButton());
    await userEvent.keyboard("{Enter}");
    await expect.element(dialog()).toBeVisible();
    await waitForPopupSettled(popup() as HTMLElement);
    await expect.poll(focusedDayLabel).toBe(fullDate(d(2026, 9, 10)));
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{Enter}");
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(texts()).toEqual(["09", "11", "2026"]);
    await expect.poll(() => document.activeElement).toBe(iconButton());
  });

  it("Escape closes without changing the value and returns focus to the icon button", async () => {
    const onValueChange = vi.fn();
    await render(<Editable defaultValue={d(2026, 9, 10)} onValueChange={onValueChange} />);
    await openCalendar();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(iconButton());
    expect(texts()).toEqual(["09", "10", "2026"]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("follows a controlled value", async () => {
    const screen = await render(<Editable value={d(2026, 9, 5)} />);
    expect(texts()).toEqual(["09", "05", "2026"]);
    await screen.rerender(<Editable value={d(2026, 10, 6)} />);
    expect(texts()).toEqual(["10", "06", "2026"]);
  });

  it("passes min / max / isDateDisabled to the field and the calendar", async () => {
    await render(
      <Editable
        defaultValue={d(2026, 9, 5)}
        min={d(2026, 9, 10)}
        isDateDisabled={(date) => date.getDay() === 0}
      />,
    );
    expect(document.querySelector("[data-slot=date-field]")?.hasAttribute("data-invalid")).toBe(
      true,
    );
    await openCalendar();
    expect(
      dayButton(d(2026, 9, 9))
        .element()
        .getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("is disabled as a whole", async () => {
    await render(<Editable disabled />);
    expect(iconButton().disabled).toBe(true);
    expect(document.querySelector("[data-slot=date-field]")?.hasAttribute("data-disabled")).toBe(
      true,
    );
    await userEvent.click(iconButton(), { force: true });
    await expect.element(dialog()).not.toBeInTheDocument();
  });

  it("sits at the Input / Select heights per size, the button inside the border", async () => {
    await render(
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
            <div className="w-56">
              <DatePicker editable aria-label={`date-${size}`} size={size} locale="en-US" />
            </div>
          </div>
        ))}
      </div>,
    );
    const heights = { sm: 32, md: 40, lg: 48 };
    for (const size of ["sm", "md", "lg"] as const) {
      const input = page.getByRole("textbox", { name: `input-${size}` }).element();
      const group = page.getByRole("group", { name: `date-${size}` }).element();
      expect(group.getBoundingClientRect().height).toBe(heights[size]);
      expect(group.getBoundingClientRect().height).toBe(input.getBoundingClientRect().height);
      const i = getComputedStyle(input);
      const g = getComputedStyle(group);
      expect(g.paddingLeft).toBe(i.paddingLeft);
      expect(g.fontSize).toBe(i.fontSize);
      expect(g.borderTopColor).toBe(i.borderTopColor);
      expect(g.borderRadius).toBe(i.borderRadius);
      const button = group.parentElement?.querySelector("button") as HTMLElement;
      const b = button.getBoundingClientRect();
      const r = group.getBoundingClientRect();
      // Vertically centred inside the border.
      expect(Math.abs(b.top - r.top - (r.bottom - b.bottom))).toBeLessThanOrEqual(1);
      expect(b.height).toBeLessThan(r.height);
    }
  });

  it("shows a ring on the icon button on Tab focus, a Highlight ring in forced colors", async () => {
    await render(<Editable />);
    await userEvent.click(seg("year"));
    await userEvent.tab();
    expect(document.activeElement).toBe(iconButton());
    expect(getComputedStyle(iconButton()).outlineStyle).toBe("solid");
    await emulateForcedColors(true);
    expect(getComputedStyle(iconButton()).outlineColor).toBe(systemColor("Highlight"));
  });

  it("forced colors: a focused segment is Highlight on HighlightText", async () => {
    await render(<Editable />);
    await emulateForcedColors(true);
    await userEvent.click(seg("month"));
    const style = getComputedStyle(seg("month"));
    expect(style.backgroundColor).toBe(systemColor("Highlight"));
    expect(style.color).toBe(systemColor("HighlightText"));
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations closed and open (%s)",
    async (theme) => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(
        <div className="bg-background p-16">
          <Field>
            <FieldLabel>Due date</FieldLabel>
            <DatePicker editable locale="en-US" defaultValue={d(2026, 9, 5)} />
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

describe("DatePicker: editable in Field and Form", () => {
  it("the Field label names the group and clicking it focuses the first segment; the description describes it", async () => {
    await render(
      <div className="p-16">
        <Field>
          <FieldLabel>Due date</FieldLabel>
          <DatePicker editable locale="en-US" />
        </Field>
      </div>,
    );
    await expect.element(page.getByRole("group", { name: "Due date" })).toBeInTheDocument();
    await userEvent.click(document.querySelector("[data-slot=field-label]") as HTMLElement);
    expect(document.activeElement).toBe(seg("month"));
  });

  it("registers one Field control and one hidden input", async () => {
    await render(
      <div className="p-16">
        <Field name="due">
          <FieldLabel>Due date</FieldLabel>
          <DatePicker editable locale="en-US" defaultValue={d(2026, 9, 5)} />
        </Field>
      </div>,
    );
    expect(document.querySelectorAll("[data-slot=date-form-control]").length).toBe(1);
  });

  it("an invalid Field marks the segments and the group", async () => {
    await render(
      <div className="p-16">
        <Field invalid>
          <FieldLabel>Due date</FieldLabel>
          <DatePicker editable locale="en-US" />
          <FieldError match>Pick a due date.</FieldError>
        </Field>
      </div>,
    );
    expect(document.querySelector("[data-slot=date-field]")?.hasAttribute("data-invalid")).toBe(
      true,
    );
    expect(seg("month").getAttribute("aria-invalid")).toBe("true");
  });

  it("a disabled Field disables it", async () => {
    await render(
      <Field disabled>
        <FieldLabel>Due date</FieldLabel>
        <DatePicker editable locale="en-US" />
      </Field>,
    );
    expect(iconButton().disabled).toBe(true);
    expect(seg("month").tabIndex).toBe(-1);
  });

  function FormUi(props: { onFormSubmit?: (values: unknown) => void; required?: boolean }) {
    return (
      <div className="p-16">
        <Form aria-label="Invoice" onFormSubmit={props.onFormSubmit}>
          <Field name="note">
            <FieldLabel>Note</FieldLabel>
            <Input />
          </Field>
          <Field name="due">
            <FieldLabel>Due date</FieldLabel>
            <DatePicker
              editable
              locale="en-US"
              required={props.required}
              min={d(2026, 9, 1)}
              defaultValue={props.required ? undefined : d(2026, 9, 5)}
            />
            <FieldError />
          </Field>
          <Button type="submit">Send</Button>
        </Form>
      </div>
    );
  }
  const send = () => userEvent.click(page.getByRole("button", { name: "Send" }));

  it("required blocks the submit, shows the error and focuses the first segment", async () => {
    const onFormSubmit = vi.fn();
    await render(<FormUi required onFormSubmit={onFormSubmit} />);
    await send();
    await expect.poll(() => document.activeElement).toBe(seg("month"));
    expect(onFormSubmit).not.toHaveBeenCalled();
    expect(document.querySelector("[data-slot=field-error]")?.textContent).not.toBe("");
    expect(seg("month").getAttribute("aria-invalid")).toBe("true");
  });

  it("typing a date clears the error and submits it under the field name", async () => {
    const onFormSubmit = vi.fn();
    await render(<FormUi required onFormSubmit={onFormSubmit} />);
    await send();
    await expect.poll(() => document.activeElement).toBe(seg("month"));
    await type("09202026");
    await send();
    await expect.poll(() => onFormSubmit.mock.calls.length).toBe(1);
    expect(onFormSubmit.mock.calls[0]?.[0]).toEqual({ note: "", due: "2026-09-20" });
  });

  it("a pick in the calendar submits the picked day", async () => {
    const onFormSubmit = vi.fn();
    await render(<FormUi required onFormSubmit={onFormSubmit} />);
    await openCalendar();
    await userEvent.click(dayButton(d(2026, 9, 18)));
    await send();
    await expect.poll(() => onFormSubmit.mock.calls.length).toBe(1);
    expect(onFormSubmit.mock.calls[0]?.[0]).toEqual({ note: "", due: "2026-09-18" });
  });

  it("a partial date is invalid at submit", async () => {
    const onFormSubmit = vi.fn();
    await render(<FormUi onFormSubmit={onFormSubmit} />);
    await userEvent.click(seg("day"));
    await userEvent.keyboard("{Backspace}");
    await send();
    await expect.poll(() => document.activeElement).toBe(seg("month"));
    expect(onFormSubmit).not.toHaveBeenCalled();
    await expect.element(page.getByText("Enter a complete date.")).toBeVisible();
  });

  it("submits the ISO date through native FormData when named", async () => {
    let data: FormData | null = null;
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <DatePicker editable aria-label="Due" name="due" defaultValue={d(2026, 9, 5)} />
        <button type="submit">Save</button>
      </form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => data).not.toBeNull();
    expect((data as unknown as FormData).get("due")).toBe("2026-09-05");
  });
});
