import axe from "axe-core";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, systemColor } from "../../../test/emulation";
import { Button } from "../button";
import type { DateRange } from "../calendar";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import { Input } from "../input";
import { DateRangeField, type DateRangeFieldProps } from "./date-range-field";

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

type Half = "start" | "end";
type SegmentType = "day" | "month" | "year";

const root = () =>
  document.querySelector<HTMLElement>("[data-slot=date-range-field]") as HTMLElement;
const half = (which: Half) =>
  document.querySelector<HTMLElement>(`[data-slot=date-range-field-${which}]`) as HTMLElement;
const seg = (which: Half, type: SegmentType) =>
  half(which).querySelector<HTMLElement>(
    `[data-slot=date-field-segment][data-type=${type}]`,
  ) as HTMLElement;
const segments = (scope: ParentNode = document) => [
  ...scope.querySelectorAll<HTMLElement>("[data-slot=date-field-segment]"),
];
const texts = (which: Half) => segments(half(which)).map((s) => s.textContent);
/** "start:month", or null when focus is outside the segments. */
const focused = () => {
  const element = document.activeElement as HTMLElement | null;
  const type = element?.getAttribute("data-type");
  if (!element || !type) return null;
  return `${element.closest("[data-slot=date-range-field-end]") ? "end" : "start"}:${type}`;
};

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

function Basic(props: DateRangeFieldProps) {
  return <DateRangeField aria-label="Stay" locale="en-US" {...props} />;
}

describe("DateRangeField: structure", () => {
  it("is one group holding a start and an end segment set, with an aria-hidden en dash between", async () => {
    await render(<Basic className="w-96" />);
    await expect
      .element(page.getByRole("group", { name: "Stay", exact: true }))
      .toBeInTheDocument();
    const element = root();
    expect(element.getAttribute("role")).toBe("group");
    expect(element.classList.contains("w-96")).toBe(true);
    expect(segments(element)).toHaveLength(6);
    expect(texts("start")).toEqual(["mm", "dd", "yyyy"]);
    expect(texts("end")).toEqual(["mm", "dd", "yyyy"]);
    const separator = element.querySelector(
      "[data-slot=date-range-field-separator]",
    ) as HTMLElement;
    expect(separator.textContent).toBe("–");
    expect(separator.getAttribute("aria-hidden")).toBe("true");
    // Start, separator, end, in that order.
    const children = [...element.children].map((child) => child.getAttribute("data-slot"));
    expect(children).toEqual([
      "date-range-field-start",
      "date-range-field-separator",
      "date-range-field-end",
    ]);
    // Spacing around the dash, glyph to glyph.
    const textRect = (element: HTMLElement) => {
      const text = document.createRange();
      text.selectNodeContents(element.firstChild as Node);
      return text.getBoundingClientRect();
    };
    const dash = textRect(separator);
    expect(dash.left - textRect(seg("start", "year")).right).toBeGreaterThanOrEqual(6);
    expect(textRect(seg("end", "month")).left - dash.right).toBeGreaterThanOrEqual(6);
  });

  it("names the halves 'Start date' / 'End date' with the field's name, and each segment after its half", async () => {
    await render(<Basic />);
    await expect
      .element(page.getByRole("group", { name: "Start date Stay", exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("group", { name: "End date Stay", exact: true }))
      .toBeInTheDocument();
    for (const name of ["month Start date Stay", "year End date Stay", "day End date Stay"]) {
      await expect.element(page.getByRole("spinbutton", { name, exact: true })).toBeInTheDocument();
    }
    // Segment ids stay unique across the halves.
    const ids = segments().map((s) => s.id);
    expect(new Set(ids).size).toBe(6);
  });

  it("localises the half names through labels", async () => {
    await render(<Basic labels={{ start: "Anreise", end: "Abreise" }} />);
    await expect
      .element(page.getByRole("group", { name: "Anreise Stay", exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("spinbutton", { name: "month Abreise Stay", exact: true }))
      .toBeInTheDocument();
  });

  it("shows the value in both halves", async () => {
    await render(<Basic defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))} />);
    expect(texts("start")).toEqual(["09", "01", "2026"]);
    expect(texts("end")).toEqual(["09", "12", "2026"]);
  });
});

describe("DateRangeField: keyboard", () => {
  it("←/→ cross the boundary between the halves; Tab visits every segment", async () => {
    await render(
      <div>
        <Basic />
        <button type="button">after</button>
      </div>,
    );
    await userEvent.tab();
    expect(focused()).toBe("start:month");
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toBe("start:year");
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toBe("end:month");
    await userEvent.keyboard("{ArrowLeft}");
    expect(focused()).toBe("start:year");
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toBe("end:year");
    await userEvent.tab({ shift: true });
    expect(focused()).toBe("end:day");
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe("after");
  });

  it("typing a complete start date moves into the end's first segment", async () => {
    await render(<Basic />);
    await userEvent.click(seg("start", "month"));
    await type("0901");
    expect(focused()).toBe("start:year");
    await type("2026");
    expect(focused()).toBe("end:month");
    await type("0912");
    expect(focused()).toBe("end:year");
    await type("2026");
    expect(focused()).toBe("end:year");
    expect(texts("start")).toEqual(["09", "01", "2026"]);
    expect(texts("end")).toEqual(["09", "12", "2026"]);
  });

  it("Backspace on the end's empty first segment goes back into the start", async () => {
    await render(<Basic defaultValue={range(d(2026, 9, 1), null)} />);
    await userEvent.click(seg("end", "month"));
    await userEvent.keyboard("{Backspace}");
    expect(focused()).toBe("start:year");
    expect(texts("start")).toEqual(["09", "01", "2026"]);
  });

  it("ar-EG in RTL: the start sits on the right, and ←/→ follow the visual order across the halves", async () => {
    const onValueChange = vi.fn();
    await render(
      <div dir="rtl">
        <DateRangeField aria-label="الإقامة" locale="ar-EG" onValueChange={onValueChange} />
      </div>,
    );
    expect(segments(half("start")).map((s) => s.dataset.type)).toEqual(["day", "month", "year"]);
    expect(half("start").getBoundingClientRect().left).toBeGreaterThan(
      half("end").getBoundingClientRect().left,
    );
    await userEvent.click(seg("start", "year"));
    // The next segment sits to the left: ArrowLeft goes forward into the end, ArrowRight back.
    await userEvent.keyboard("{ArrowLeft}");
    expect(focused()).toBe("end:day");
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toBe("start:year");
    await userEvent.click(seg("start", "day"));
    await type("٠١٠٩٢٠٢٦");
    expect(focused()).toBe("end:day");
    await type("12092026");
    expect(onValueChange).toHaveBeenLastCalledWith(range(d(2026, 9, 1), d(2026, 9, 12)));
    expect(texts("end")).toEqual(["١٢", "٠٩", "٢٠٢٦"]);
  });

  it("each half keeps DateField's keys: stepping, Home/End and clearing stay inside a segment", async () => {
    await render(<Basic defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))} />);
    await userEvent.click(seg("end", "day"));
    await userEvent.keyboard("{ArrowUp}");
    expect(texts("end")).toEqual(["09", "13", "2026"]);
    await userEvent.keyboard("{End}");
    expect(texts("end")).toEqual(["09", "30", "2026"]);
    await userEvent.keyboard("{Delete}");
    expect(texts("end")).toEqual(["09", "dd", "2026"]);
    expect(texts("start")).toEqual(["09", "01", "2026"]);
    expect(focused()).toBe("end:day");
  });
});

describe("DateRangeField: paste", () => {
  it.each([
    "2026-09-01 – 2026-09-12",
    "2026-09-01/2026-09-12",
    "2026-09-01 - 2026-09-12",
    "2026-09-01 2026-09-12",
    "9/1/2026 - 9/12/2026",
    "9/1/2026 – 9/12/2026",
    "9/1/2026 to 9/12/2026",
  ])("pasting %j fills both halves and reports the pair once", async (text) => {
    const onValueChange = vi.fn();
    await render(<Basic onValueChange={onValueChange} />);
    await userEvent.click(seg("end", "day"));
    paste(seg("end", "day"), text);
    await expect.poll(() => texts("end")).toEqual(["09", "12", "2026"]);
    expect(texts("start")).toEqual(["09", "01", "2026"]);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(range(d(2026, 9, 1), d(2026, 9, 12)));
  });

  it("pastes two locale dates in the locale's order (de-DE)", async () => {
    const onValueChange = vi.fn();
    await render(
      <DateRangeField aria-label="Aufenthalt" locale="de-DE" onValueChange={onValueChange} />,
    );
    await userEvent.click(seg("start", "day"));
    paste(seg("start", "day"), "01.09.2026 - 12.09.2026");
    await expect.poll(() => texts("end")).toEqual(["12", "09", "2026"]);
    expect(onValueChange).toHaveBeenLastCalledWith(range(d(2026, 9, 1), d(2026, 9, 12)));
  });

  it("a single date fills only the half it is pasted into; junk changes nothing", async () => {
    const onValueChange = vi.fn();
    await render(
      <Basic defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))} onValueChange={onValueChange} />,
    );
    await userEvent.click(seg("end", "month"));
    paste(seg("end", "month"), "2026-10-03");
    await expect.poll(() => texts("end")).toEqual(["10", "03", "2026"]);
    expect(texts("start")).toEqual(["09", "01", "2026"]);
    expect(onValueChange).toHaveBeenLastCalledWith(range(d(2026, 9, 1), d(2026, 10, 3)));
    paste(seg("end", "month"), "not a range");
    paste(seg("end", "month"), "9/1/2026 – 2/30/2026");
    // A valid paste after the junk settles first, so the junk had its chance to report.
    paste(seg("start", "month"), "2026-09-02");
    await expect.poll(() => texts("start")).toEqual(["09", "02", "2026"]);
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it("read-only ignores a paste", async () => {
    const onValueChange = vi.fn();
    await render(<Basic readOnly onValueChange={onValueChange} />);
    await userEvent.click(seg("start", "month"));
    paste(seg("start", "month"), "2026-09-01/2026-09-12");
    await userEvent.keyboard("{ArrowUp}");
    expect(texts("start")).toEqual(["mm", "dd", "yyyy"]);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("DateRangeField: value", () => {
  it("reports the pair when either half becomes a complete date or null; partial input never reports", async () => {
    const onValueChange = vi.fn();
    await render(<Basic onValueChange={onValueChange} />);
    await userEvent.click(seg("start", "month"));
    await type("0901202");
    expect(onValueChange).not.toHaveBeenCalled();
    await type("6");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(range(d(2026, 9, 1), null));
    await type("09");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    await type("122026");
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenLastCalledWith(range(d(2026, 9, 1), d(2026, 9, 12)));
    // Clearing a segment of the complete start reports null for it, the end kept.
    await userEvent.click(seg("start", "day"));
    await userEvent.keyboard("{Backspace}");
    expect(onValueChange).toHaveBeenCalledTimes(3);
    expect(onValueChange).toHaveBeenLastCalledWith(range(null, d(2026, 9, 12)));
  });

  it("a year still being typed is reported on the blur into the other half", async () => {
    const onValueChange = vi.fn();
    await render(<Basic onValueChange={onValueChange} />);
    await userEvent.click(seg("start", "month"));
    await type("090120");
    await userEvent.click(seg("end", "month"));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    const reported = onValueChange.mock.lastCall?.[0] as DateRange;
    expect(reported.start?.getFullYear()).toBe(20);
  });

  it("controlled: follows the value, and keeps it when the parent ignores a change", async () => {
    const screen = await render(<Basic value={range(d(2026, 9, 1), d(2026, 9, 12))} />);
    await userEvent.click(seg("end", "day"));
    await type("4");
    expect(texts("end")).toEqual(["09", "12", "2026"]);
    await screen.rerender(<Basic value={range(null, d(2026, 10, 2))} />);
    expect(texts("start")).toEqual(["mm", "dd", "yyyy"]);
    expect(texts("end")).toEqual(["10", "02", "2026"]);
  });

  it("controlled: a parent that stores the pair keeps both halves in step", async () => {
    function Parent() {
      const [value, setValue] = useState<DateRange>({ start: null, end: null });
      return (
        <div>
          <Basic value={value} onValueChange={setValue} />
          <output>
            {value.start?.toDateString() ?? "none"} / {value.end?.toDateString() ?? "none"}
          </output>
        </div>
      );
    }
    const screen = await render(<Parent />);
    await userEvent.click(seg("start", "month"));
    await type("09012026");
    await type("0912");
    // The start is stored while the end is still partial: the end's typing survives the render.
    expect(texts("end")).toEqual(["09", "12", "yyyy"]);
    await type("2026");
    await expect
      .element(
        screen.getByText(`${d(2026, 9, 1).toDateString()} / ${d(2026, 9, 12).toDateString()}`),
      )
      .toBeInTheDocument();
    paste(seg("start", "month"), "2026-10-01/2026-10-05");
    await expect
      .element(
        screen.getByText(`${d(2026, 10, 1).toDateString()} / ${d(2026, 10, 5).toDateString()}`),
      )
      .toBeInTheDocument();
  });
});

describe("DateRangeField: validation", () => {
  it("an end before the start is invalid (never swapped)", async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <div>
        <Basic onValueChange={onValueChange} />
        <div data-testid="ref" className="border border-danger" />
      </div>,
    );
    await userEvent.click(seg("start", "month"));
    await type("09122026");
    await type("09012026");
    expect(onValueChange).toHaveBeenLastCalledWith(range(d(2026, 9, 12), d(2026, 9, 1)));
    expect(texts("start")).toEqual(["09", "12", "2026"]);
    expect(texts("end")).toEqual(["09", "01", "2026"]);
    const element = root();
    expect(element.hasAttribute("data-invalid")).toBe(true);
    for (const s of segments()) expect(s.getAttribute("aria-invalid")).toBe("true");
    // Polled: the border colour transitions into the danger colour.
    await expect
      .poll(() => getComputedStyle(element).borderTopColor)
      .toBe(getComputedStyle(screen.getByTestId("ref").element()).borderTopColor);
    // The same day on both ends is a valid one-day range.
    await userEvent.click(seg("end", "day"));
    await type("12");
    expect(element.hasAttribute("data-invalid")).toBe(false);
  });

  it("an end outside min / max is invalid at once", async () => {
    await render(
      <Basic max={d(2026, 9, 10)} defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))} />,
    );
    expect(root().hasAttribute("data-invalid")).toBe(true);
  });

  it("moves an aria-invalid prop onto the segments", async () => {
    await render(<Basic aria-invalid="true" />);
    expect(root().hasAttribute("aria-invalid")).toBe(false);
    expect(root().hasAttribute("data-invalid")).toBe(true);
    expect(seg("end", "year").getAttribute("aria-invalid")).toBe("true");
  });
});

describe("DateRangeField: Form", () => {
  function DateForm({
    children,
    onFormSubmit,
    validationMode,
  }: {
    children: React.ReactNode;
    onFormSubmit?: (values: Record<string, unknown>) => void;
    validationMode?: "onSubmit" | "onBlur";
  }) {
    return (
      <Form
        aria-label="Booking"
        onFormSubmit={onFormSubmit ?? (() => {})}
        validationMode={validationMode}
      >
        <Field name="stay">
          <FieldLabel>Stay</FieldLabel>
          {children}
          <FieldError />
        </Field>
        <Input aria-label="After" />
        <Button type="submit">Send</Button>
      </Form>
    );
  }
  const send = () => userEvent.click(page.getByRole("button", { name: "Send", exact: true }));

  it("is one Field control: one hidden input, and onFormSubmit gets { start, end }", async () => {
    const onFormSubmit = vi.fn();
    await render(
      <DateForm onFormSubmit={onFormSubmit}>
        <DateRangeField locale="en-US" defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))} />
      </DateForm>,
    );
    expect(document.querySelectorAll("[data-slot=date-form-control]")).toHaveLength(1);
    await send();
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1));
    expect(onFormSubmit.mock.calls[0]?.[0]).toEqual({
      stay: { start: "2026-09-01", end: "2026-09-12" },
    });
  });

  it("the Field label names the group and clicking it focuses the first empty segment", async () => {
    await render(
      <DateForm>
        <DateRangeField locale="en-US" defaultValue={range(d(2026, 9, 1), null)} />
        <FieldDescription>Check-in and check-out.</FieldDescription>
      </DateForm>,
    );
    const group = page.getByRole("group", { name: "Stay", exact: true });
    await expect.element(group).toBeInTheDocument();
    await expect.element(group).toHaveAccessibleDescription("Check-in and check-out.");
    await expect
      .element(page.getByRole("group", { name: "End date Stay", exact: true }))
      .toBeInTheDocument();
    const label = document.querySelector("[data-slot=field-label]") as HTMLLabelElement;
    expect(label.htmlFor).toBe("");
    await userEvent.click(label);
    expect(focused()).toBe("end:month");
  });

  it("required blocks the submit and focuses the first segment; only one end is incomplete", async () => {
    const onFormSubmit = vi.fn();
    await render(
      <DateForm onFormSubmit={onFormSubmit}>
        <DateRangeField locale="en-US" required />
      </DateForm>,
    );
    await send();
    await expect.poll(() => focused()).toBe("start:month");
    expect(onFormSubmit).not.toHaveBeenCalled();
    expect(seg("start", "month").getAttribute("aria-invalid")).toBe("true");
    await type("09012026");
    await send();
    await expect.element(page.getByText("Enter a complete date range.")).toBeVisible();
    expect(onFormSubmit).not.toHaveBeenCalled();
  });

  it("partial input and a reversed range block the submit with their messages", async () => {
    const onFormSubmit = vi.fn();
    await render(
      <DateForm onFormSubmit={onFormSubmit}>
        <DateRangeField
          locale="en-US"
          defaultValue={range(d(2026, 9, 12), d(2026, 9, 1))}
          labels={{ rangeReversed: "Abreise vor Anreise." }}
        />
      </DateForm>,
    );
    await send();
    await expect.element(page.getByText("Abreise vor Anreise.")).toBeVisible();
    expect(onFormSubmit).not.toHaveBeenCalled();
    await userEvent.click(seg("end", "year"));
    await userEvent.keyboard("{Backspace}");
    await send();
    await expect.element(page.getByText("Enter a complete date range.")).toBeVisible();
    expect(onFormSubmit).not.toHaveBeenCalled();
  });

  it("the default reversed-range message", async () => {
    await render(
      <DateForm>
        <DateRangeField locale="en-US" defaultValue={range(d(2026, 9, 12), d(2026, 9, 1))} />
      </DateForm>,
    );
    await send();
    await expect
      .element(page.getByText("The end date must be on or after the start date."))
      .toBeVisible();
  });

  it("Enter in either half submits (a year still being typed is reported first)", async () => {
    const onFormSubmit = vi.fn();
    await render(
      <DateForm onFormSubmit={onFormSubmit}>
        <DateRangeField locale="en-US" defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))} />
      </DateForm>,
    );
    await userEvent.click(seg("start", "day"));
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1));
    await userEvent.click(seg("start", "year"));
    await userEvent.keyboard("{Backspace}");
    await type("20");
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(2));
    expect(onFormSubmit.mock.calls[1]?.[0]).toEqual({
      stay: { start: "0020-09-01", end: "2026-09-12" },
    });
  });

  it("an Enter that commits an IME composition does not submit", async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    await render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <Basic defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))} />
      </form>,
    );
    const form = document.querySelector("form") as HTMLFormElement;
    const requestSubmit = vi.spyOn(form, "requestSubmit");
    await userEvent.click(seg("end", "day"));
    const enter = (init: KeyboardEventInit, keyCode?: number) => {
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
        ...init,
      });
      if (keyCode !== undefined) Object.defineProperty(event, "keyCode", { get: () => keyCode });
      seg("end", "day").dispatchEvent(event);
    };
    enter({ isComposing: true });
    enter({}, 229);
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => onSubmit.mock.calls.length).toBe(1);
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it("types full-width digits from a composing IME into the end half", async () => {
    const onValueChange = vi.fn();
    await render(
      <Basic defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))} onValueChange={onValueChange} />,
    );
    await userEvent.click(seg("end", "month"));
    await cdp().send("Input.imeSetComposition", { text: "１", selectionStart: 1, selectionEnd: 1 });
    await cdp().send("Input.insertText", { text: "１" });
    await cdp().send("Input.imeSetComposition", { text: "０", selectionStart: 1, selectionEnd: 1 });
    await cdp().send("Input.insertText", { text: "０" });
    await expect.poll(focused).toBe("end:day");
    expect(onValueChange).toHaveBeenLastCalledWith(range(d(2026, 9, 1), d(2026, 10, 12)));
    expect(texts("end")).toEqual(["10", "12", "2026"]);
  });

  it("validationMode onBlur: moving between the halves is not a blur; leaving the group is", async () => {
    await render(
      <DateForm validationMode="onBlur">
        <DateRangeField locale="en-US" />
      </DateForm>,
    );
    const incomplete = page.getByText("Enter a complete date range.");
    await userEvent.click(seg("start", "month"));
    await type("09012026");
    expect(focused()).toBe("end:month");
    await expect.element(incomplete).not.toBeInTheDocument();
    await userEvent.keyboard("{ArrowLeft}");
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.tab();
    await userEvent.tab();
    expect(focused()).toBe("end:year");
    await expect.element(incomplete).not.toBeInTheDocument();
    await userEvent.tab();
    await expect.element(incomplete).toBeVisible();
  });

  it("submits the ISO interval under name, and each end under startName / endName", async () => {
    let data: FormData | null = null;
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <Basic
          name="stay"
          startName="from"
          endName="to"
          defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))}
        />
        <DateRangeField aria-label="Empty" locale="en-US" name="e" startName="a" endName="b" />
        <button type="submit" formNoValidate>
          Save
        </button>
      </form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => data).not.toBeNull();
    expect(Object.fromEntries((data as unknown as FormData).entries())).toEqual({
      stay: "2026-09-01/2026-09-12",
      from: "2026-09-01",
      to: "2026-09-12",
      e: "",
      a: "",
      b: "",
    });
  });
});

describe("DateRangeField: states", () => {
  it("disabled: no Tab stops, aria-disabled segments, not-allowed cursor", async () => {
    await render(
      <div>
        <Basic disabled defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))} />
        <button type="button">after</button>
      </div>,
    );
    expect(root().hasAttribute("data-disabled")).toBe(true);
    expect(getComputedStyle(root()).cursor).toBe("not-allowed");
    for (const s of segments()) {
      expect(s.hasAttribute("tabindex")).toBe(false);
      expect(s.getAttribute("aria-disabled")).toBe("true");
    }
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe("after");
  });

  it("a disabled Field disables it", async () => {
    await render(
      <Field disabled>
        <FieldLabel>Stay</FieldLabel>
        <DateRangeField locale="en-US" />
      </Field>,
    );
    expect(root().hasAttribute("data-disabled")).toBe(true);
  });

  it("readOnly: focusable and navigable across the halves, but never edits", async () => {
    const onValueChange = vi.fn();
    await render(
      <Basic
        readOnly
        defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))}
        onValueChange={onValueChange}
      />,
    );
    expect(root().hasAttribute("data-readonly")).toBe(true);
    await userEvent.click(seg("start", "year"));
    await userEvent.keyboard("{ArrowUp}");
    await type("4");
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toBe("end:month");
    expect(texts("start")).toEqual(["09", "01", "2026"]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("clicking the padding or the dash focuses the first empty segment", async () => {
    await render(<Basic defaultValue={range(d(2026, 9, 1), null)} className="w-96" />);
    const separator = root().querySelector("[data-slot=date-range-field-separator]") as HTMLElement;
    await userEvent.click(separator);
    expect(focused()).toBe("end:month");
    const box = root().getBoundingClientRect();
    await userEvent.click(seg("start", "day"));
    await userEvent.click(root(), { position: { x: box.width - 4, y: box.height / 2 } });
    expect(focused()).toBe("end:month");
  });

  it("sits at the Input heights, padding and font per size, its text starting where Input's does", async () => {
    await render(
      <div className="flex flex-col gap-2">
        {(["sm", "md", "lg"] as const).map((size) => (
          <div key={size} className="flex gap-2">
            <Input aria-label={`input-${size}`} size={size} />
            <DateRangeField aria-label={`range-${size}`} size={size} locale="en-US" />
          </div>
        ))}
      </div>,
    );
    const heights = { sm: 32, md: 40, lg: 48 };
    for (const size of ["sm", "md", "lg"] as const) {
      const input = page.getByRole("textbox", { name: `input-${size}` }).element();
      const group = page.getByRole("group", { name: `range-${size}`, exact: true }).element();
      expect(group.getBoundingClientRect().height).toBe(heights[size]);
      expect(group.getAttribute("data-size")).toBe(size);
      const i = getComputedStyle(input);
      const g = getComputedStyle(group);
      expect(g.paddingLeft).toBe(i.paddingLeft);
      expect(g.fontSize).toBe(i.fontSize);
      expect(g.backgroundColor).toBe(i.backgroundColor);
      expect(g.borderTopColor).toBe(i.borderTopColor);
      expect(g.borderRadius).toBe(i.borderRadius);
      const text = document.createRange();
      text.selectNodeContents(group.querySelector("[data-type=month]")?.firstChild as Node);
      expect(text.getBoundingClientRect().left - group.getBoundingClientRect().left).toBeCloseTo(
        Number.parseFloat(i.borderLeftWidth) + Number.parseFloat(i.paddingLeft),
        1,
      );
    }
  });
});

describe("DateRangeField: width", () => {
  it("in a container narrower than its content, the border still wraps every segment", async () => {
    await render(
      <div className="w-40">
        <Basic size="lg" defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))} />
      </div>,
    );
    const box = root().getBoundingClientRect();
    const last = seg("end", "year").getBoundingClientRect();
    expect(box.right).toBeGreaterThanOrEqual(last.right);
    expect(root().scrollWidth).toBeLessThanOrEqual(root().clientWidth);
  });
});

describe("DateRangeField: focus and forced colors", () => {
  it("a focused segment in either half rings the whole group", async () => {
    await render(<Basic />);
    expect(getComputedStyle(root()).outlineStyle).toBe("none");
    await userEvent.click(seg("end", "day"));
    expect(getComputedStyle(root()).outlineStyle).toBe("solid");
    expect(getComputedStyle(root()).outlineWidth).toBe("1px");
  });

  it("in forced colors: a Highlight ring and a Highlight segment, invalid included", async () => {
    await render(<Basic defaultValue={range(d(2026, 9, 12), d(2026, 9, 1))} />);
    await emulateForcedColors(true);
    expect(getComputedStyle(root()).outlineStyle).toBe("none");
    await userEvent.click(seg("end", "day"));
    const style = getComputedStyle(root());
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineColor).toBe(systemColor("Highlight"));
    const day = getComputedStyle(seg("end", "day"));
    expect(day.backgroundColor).toBe(systemColor("Highlight"));
    expect(day.color).toBe(systemColor("HighlightText"));
    expect(day.forcedColorAdjust).toBe("none");
    expect(getComputedStyle(seg("start", "day")).forcedColorAdjust).toBe("auto");
  });
});

describe("DateRangeField: accessibility", () => {
  it.each(["light", "dark"] as const)("has no axe violations (%s)", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    const screen = await render(
      <div className="flex flex-col gap-4 bg-background p-4">
        <Field>
          <FieldLabel>Stay</FieldLabel>
          <DateRangeField locale="en-US" defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))} />
          <FieldDescription>Check-in and check-out.</FieldDescription>
        </Field>
        <DateRangeField aria-label="Empty" locale="en-US" />
        <DateRangeField
          aria-label="Reversed"
          locale="en-US"
          defaultValue={range(d(2026, 9, 12), d(2026, 9, 1))}
        />
        <DateRangeField
          aria-label="Disabled"
          locale="en-US"
          disabled
          defaultValue={range(TODAY, TODAY)}
        />
        <DateRangeField
          aria-label="Read-only"
          locale="en-US"
          readOnly
          defaultValue={range(TODAY, null)}
        />
        <div dir="rtl">
          <DateRangeField aria-label="الإقامة" locale="ar-EG" defaultValue={range(TODAY, TODAY)} />
        </div>
      </div>,
    );
    await userEvent.click(seg("end", "day"));
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
  });
});
