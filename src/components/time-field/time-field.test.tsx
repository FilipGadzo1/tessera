import axe from "axe-core";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  emulateForcedColors,
  emulateReducedMotion,
  resetEmulatedMedia,
  systemColor,
} from "../../../test/emulation";
import { formatTime } from "../../lib/time";
import { Button } from "../button";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import { Input } from "../input";
import { TimeField, type TimeFieldProps } from "./time-field";

type SegmentType = "hour" | "minute" | "second" | "dayPeriod";

afterEach(async () => {
  document.documentElement.classList.remove("dark");
  await resetEmulatedMedia();
  vi.restoreAllMocks();
});

const root = (scope: ParentNode = document) =>
  scope.querySelector<HTMLElement>("[data-slot=time-field]") as HTMLElement;
const seg = (type: SegmentType, scope: ParentNode = document) =>
  scope.querySelector<HTMLElement>(
    `[data-slot=time-field-segment][data-type=${type}]`,
  ) as HTMLElement;
const segments = (scope: ParentNode = document) => [
  ...scope.querySelectorAll<HTMLElement>("[data-slot=time-field-segment]"),
];
const texts = (scope: ParentNode = document) => segments(scope).map((s) => s.textContent);
const focusedType = () => document.activeElement?.getAttribute("data-type") ?? null;
const hiddenInput = (scope: ParentNode = document) =>
  scope.querySelector<HTMLInputElement>("[data-slot=time-form-control]") as HTMLInputElement;
const valueNow = (type: SegmentType) => seg(type).getAttribute("aria-valuenow");

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

function Basic(props: TimeFieldProps) {
  return <TimeField aria-label="Start time" locale="en-US" {...props} />;
}

describe("TimeField: structure", () => {
  it("renders a group of spinbuttons named by the segment plus the field, with aria-hidden literals", async () => {
    await render(<Basic className="w-64" />);
    await expect.element(page.getByRole("group", { name: "Start time" })).toBeInTheDocument();
    expect(root().classList.contains("w-64")).toBe(true);
    expect(root().getAttribute("data-size")).toBe("md");
    expect(segments().map((s) => s.dataset.type)).toEqual(["hour", "minute", "dayPeriod"]);
    for (const name of ["hour Start time", "minute Start time", "AM/PM Start time"]) {
      await expect.element(page.getByRole("spinbutton", { name, exact: true })).toBeInTheDocument();
    }
    const literals = [...root().querySelectorAll("[data-slot=time-field-literal]")];
    expect(literals.map((l) => l.textContent?.trim())).toEqual([":", ""]);
    for (const literal of literals) expect(literal.getAttribute("aria-hidden")).toBe("true");
    for (const s of segments()) {
      expect(s.tabIndex).toBe(0);
      expect(s.hasAttribute("data-placeholder")).toBe(true);
    }
    expect(texts()).toEqual(["––", "––", "––"]);
    expect(seg("hour").getAttribute("inputmode")).toBe("numeric");
    expect(seg("dayPeriod").getAttribute("inputmode")).toBe("text");
  });

  it("wraps the row in the locale's direction and the clock run (hour to minute) in LTR", async () => {
    await render(<Basic />);
    const row = root().querySelector("[data-slot=time-field-segments]") as HTMLElement;
    expect(row.getAttribute("dir")).toBe("ltr");
    const clock = row.querySelector("[data-slot=time-field-clock]") as HTMLElement;
    expect(clock.getAttribute("dir")).toBe("ltr");
    expect(
      [...clock.querySelectorAll("[data-type]")].map((s) => s.getAttribute("data-type")),
    ).toEqual(["hour", "minute"]);
    expect(clock.contains(seg("dayPeriod"))).toBe(false);
  });

  it("de-DE has two segments; second granularity adds one", async () => {
    const { rerender } = await render(<TimeField aria-label="Zeit" locale="de-DE" />);
    expect(segments().map((s) => s.dataset.type)).toEqual(["hour", "minute"]);
    expect(seg("hour").getAttribute("aria-label")).toBe("Stunde");
    await rerender(<TimeField aria-label="Zeit" locale="de-DE" granularity="second" />);
    expect(segments().map((s) => s.dataset.type)).toEqual(["hour", "minute", "second"]);
    await rerender(<Basic granularity="second" />);
    expect(segments().map((s) => s.dataset.type)).toEqual([
      "hour",
      "minute",
      "second",
      "dayPeriod",
    ]);
  });

  it("exposes spinbutton values: valuenow / min / max / valuetext", async () => {
    await render(<Basic defaultValue="21:05" />);
    expect(texts()).toEqual(["09", "05", "PM"]);
    expect(valueNow("hour")).toBe("9");
    expect(seg("hour").getAttribute("aria-valuemin")).toBe("1");
    expect(seg("hour").getAttribute("aria-valuemax")).toBe("12");
    expect(seg("hour").getAttribute("aria-valuetext")).toBe("9");
    expect(seg("minute").getAttribute("aria-valuemin")).toBe("0");
    expect(seg("minute").getAttribute("aria-valuemax")).toBe("59");
    expect(seg("minute").getAttribute("aria-valuetext")).toBe("5");
    expect(valueNow("dayPeriod")).toBe("1");
    expect(seg("dayPeriod").getAttribute("aria-valuetext")).toBe("PM");
    expect(seg("hour").hasAttribute("data-placeholder")).toBe(false);
  });

  it("says 'Empty' (localisable) for an unset segment; labels rename the segments", async () => {
    const { rerender } = await render(<Basic />);
    expect(seg("minute").getAttribute("aria-valuetext")).toBe("Empty");
    expect(seg("minute").hasAttribute("aria-valuenow")).toBe(false);
    await rerender(<Basic labels={{ empty: "Leer", minute: "Minuten", dayPeriod: "Tageszeit" }} />);
    expect(seg("minute").getAttribute("aria-valuetext")).toBe("Leer");
    expect(seg("minute").getAttribute("aria-label")).toBe("Minuten");
    expect(seg("dayPeriod").getAttribute("aria-label")).toBe("Tageszeit");
  });
});

describe("TimeField: typing", () => {
  it("en-US: '9' '3' '0' reports 09:30 once (the day period fills with AM)", async () => {
    const onValueChange = vi.fn();
    await render(<Basic onValueChange={onValueChange} />);
    await userEvent.click(seg("hour"));
    await type("9");
    expect(focusedType()).toBe("minute");
    expect(seg("dayPeriod").textContent).toBe("AM");
    await type("30");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith("09:30");
    expect(focusedType()).toBe("dayPeriod");
  });

  it("en-US: '1' '2' '0' '0' 'p' ends with 12:00 (00:00 is reported first by the AM fill)", async () => {
    const onValueChange = vi.fn();
    await render(<Basic onValueChange={onValueChange} />);
    await userEvent.click(seg("hour"));
    await type("1200p");
    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual(["00:00", "12:00"]);
    expect(onValueChange).toHaveBeenLastCalledWith("12:00");
    expect(texts()).toEqual(["12", "00", "PM"]);
  });

  it("a number waiting for its next digit is held, then reported on blur or on Enter", async () => {
    const onValueChange = vi.fn();
    const submitted: (string | null)[] = [];
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted.push(new FormData(event.currentTarget).get("start") as string | null);
        }}
      >
        <Basic name="start" defaultValue="09:30" onValueChange={onValueChange} />
        <button type="button">after</button>
      </form>,
    );
    await userEvent.click(seg("minute"));
    await type("4");
    expect(texts()).toEqual(["09", "04", "AM"]);
    expect(onValueChange).not.toHaveBeenCalled();
    await userEvent.click(page.getByRole("button", { name: "after" }));
    expect(onValueChange).toHaveBeenLastCalledWith("09:04");
    await userEvent.click(seg("minute"));
    await type("2");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => submitted).toEqual(["09:02"]);
    expect(onValueChange).toHaveBeenLastCalledWith("09:02");
  });

  it("de-DE: '2' '1' '4' '5' reports 21:45", async () => {
    const onValueChange = vi.fn();
    await render(<TimeField aria-label="Zeit" locale="de-DE" onValueChange={onValueChange} />);
    await userEvent.click(seg("hour"));
    await type("2145");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith("21:45");
  });

  it("h11 (ja-JP, hourCycle 12): '0' '5' '3' '0', then 'p' on the day period → 17:30", async () => {
    const onValueChange = vi.fn();
    await render(
      <TimeField aria-label="時刻" locale="ja-JP" hourCycle={12} onValueChange={onValueChange} />,
    );
    expect(segments().map((s) => s.dataset.type)).toEqual(["dayPeriod", "hour", "minute"]);
    expect(seg("hour").getAttribute("aria-valuemin")).toBe("0");
    expect(seg("hour").getAttribute("aria-valuemax")).toBe("11");
    await userEvent.click(seg("hour"));
    await type("0530");
    expect(onValueChange).toHaveBeenLastCalledWith("05:30");
    await userEvent.click(seg("dayPeriod"));
    await type("p");
    expect(onValueChange).toHaveBeenLastCalledWith("17:30");
  });

  it("hourCycle 24 on en-US: two segments, 0–23", async () => {
    const onValueChange = vi.fn();
    await render(<Basic hourCycle={24} onValueChange={onValueChange} />);
    expect(segments().map((s) => s.dataset.type)).toEqual(["hour", "minute"]);
    await userEvent.click(seg("hour"));
    await type("1730");
    expect(onValueChange).toHaveBeenLastCalledWith("17:30");
  });

  it("auto-advance: minute '5' waits, '6' advances; h12 hour '1' waits, '2' advances", async () => {
    await render(<Basic />);
    await userEvent.click(seg("minute"));
    await type("5");
    expect(focusedType()).toBe("minute");
    await userEvent.click(seg("minute"));
    await type("6");
    expect(focusedType()).toBe("dayPeriod");
    await userEvent.click(seg("hour"));
    await type("1");
    expect(focusedType()).toBe("hour");
    await userEvent.click(seg("hour"));
    await type("2");
    expect(focusedType()).toBe("minute");
  });

  it("h12: a leading '0' shows (and announces) the typed digit while the hour is still empty", async () => {
    await render(<Basic />);
    await userEvent.click(seg("hour"));
    await type("0");
    expect(seg("hour").textContent).toBe("0");
    expect(seg("hour").getAttribute("aria-valuetext")).toBe("0");
    expect(seg("hour").hasAttribute("aria-valuenow")).toBe(false);
    await type("7");
    expect(valueNow("hour")).toBe("7");
    expect(focusedType()).toBe("minute");
  });

  it("a press after the advance (back on the segment) replaces the value", async () => {
    await render(<Basic />);
    await userEvent.click(seg("hour"));
    await type("9");
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(focusedType()).toBe("hour");
    await type("3");
    expect(valueNow("hour")).toBe("3");
  });

  it("full-width digits type in every locale; ar-EG takes Arabic-Indic and ASCII digits", async () => {
    const onValueChange = vi.fn();
    const { rerender } = await render(<Basic onValueChange={onValueChange} />);
    await userEvent.click(seg("hour"));
    await type("０８１５");
    expect(onValueChange).toHaveBeenLastCalledWith("08:15");
    await rerender(
      <div dir="rtl">
        <TimeField aria-label="الوقت" locale="ar-EG" onValueChange={onValueChange} />
      </div>,
    );
    await userEvent.click(seg("hour"));
    await type("٠٩");
    await type("4٥");
    expect(onValueChange).toHaveBeenLastCalledWith("09:45");
    expect(texts()).toEqual(["٠٩", "٤٥", "ص"]);
  });

  it("ignores letters other than the day period's", async () => {
    const onValueChange = vi.fn();
    await render(<Basic onValueChange={onValueChange} />);
    await userEvent.click(seg("hour"));
    await type("xa");
    await userEvent.click(seg("dayPeriod"));
    await type("x");
    expect(texts()).toEqual(["––", "––", "––"]);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("TimeField: keys", () => {
  it("↑/↓ wrap within the bounds (h12 12 → 1) and never carry", async () => {
    await render(<Basic defaultValue="12:59" />);
    await userEvent.click(seg("hour"));
    await userEvent.keyboard("{ArrowUp}");
    expect(valueNow("hour")).toBe("1");
    await userEvent.keyboard("{ArrowDown}");
    expect(valueNow("hour")).toBe("12");
    await userEvent.click(seg("minute"));
    await userEvent.keyboard("{ArrowUp}");
    expect(valueNow("minute")).toBe("0");
    expect(valueNow("hour")).toBe("12");
  });

  it("11 AM ↑ is 12 AM, which is 00:xx (the hour wraps within the period)", async () => {
    const onValueChange = vi.fn();
    await render(<Basic defaultValue="11:20" onValueChange={onValueChange} />);
    await userEvent.click(seg("hour"));
    await userEvent.keyboard("{ArrowUp}");
    expect(onValueChange).toHaveBeenLastCalledWith("00:20");
    expect(seg("hour").getAttribute("aria-valuetext")).toBe("12");
    expect(seg("dayPeriod").getAttribute("aria-valuetext")).toBe("AM");
  });

  it("an empty segment: ↑ goes to the min, ↓ to the max; stepping the hour fills AM", async () => {
    await render(<Basic />);
    await userEvent.click(seg("hour"));
    await userEvent.keyboard("{ArrowUp}");
    expect(valueNow("hour")).toBe("1");
    expect(seg("dayPeriod").textContent).toBe("AM");
    await userEvent.click(seg("minute"));
    await userEvent.keyboard("{ArrowDown}");
    expect(valueNow("minute")).toBe("59");
  });

  it("step 900: minutes snap to the 15-minute grid (07 ↑ 15, ↓ 00)", async () => {
    const { rerender } = await render(<Basic step={900} defaultValue="09:07" />);
    await userEvent.click(seg("minute"));
    await userEvent.keyboard("{ArrowUp}");
    expect(valueNow("minute")).toBe("15");
    await userEvent.keyboard("{ArrowUp}");
    expect(valueNow("minute")).toBe("30");
    await rerender(<Basic key="b" step={900} defaultValue="09:07" />);
    await userEvent.click(seg("minute"));
    await userEvent.keyboard("{ArrowDown}");
    expect(valueNow("minute")).toBe("0");
  });

  it("min 09:10 with step 900: the grid is 10 / 25 / 40 / 55; 09:25 is valid, 09:15 a step mismatch", async () => {
    await render(<Basic min="09:10" step={900} defaultValue="09:15" />);
    expect(root().hasAttribute("data-invalid")).toBe(true);
    expect(hiddenInput().validationMessage).toBe("Enter a time in 15-minute steps.");
    await userEvent.click(seg("minute"));
    await userEvent.keyboard("{ArrowUp}");
    expect(valueNow("minute")).toBe("25");
    expect(root().hasAttribute("data-invalid")).toBe(false);
    expect(hiddenInput().validationMessage).toBe("");
    const seen: (string | null)[] = [];
    for (let i = 0; i < 3; i++) {
      await userEvent.keyboard("{ArrowUp}");
      seen.push(valueNow("minute"));
    }
    expect(seen).toEqual(["40", "55", "10"]);
  });

  it("step 5400: minutes step by 30; 01:30 is valid and 02:30 shows the step message", async () => {
    await render(<Basic hourCycle={24} step={5400} defaultValue="01:00" />);
    await userEvent.click(seg("minute"));
    await userEvent.keyboard("{ArrowUp}");
    expect(valueNow("minute")).toBe("30");
    expect(hiddenInput().value).toBe("01:30");
    expect(root().hasAttribute("data-invalid")).toBe(false);
    await userEvent.click(seg("hour"));
    await userEvent.keyboard("{ArrowUp}");
    expect(hiddenInput().value).toBe("02:30");
    expect(root().hasAttribute("data-invalid")).toBe(true);
    expect(hiddenInput().validationMessage).toBe("Enter a time in 90-minute steps.");
  });

  it("step 3600: ↑ / ↓ leave the minutes at 00", async () => {
    await render(<Basic step={3600} defaultValue="10:00" />);
    await userEvent.click(seg("minute"));
    await userEvent.keyboard("{ArrowUp}");
    expect(valueNow("minute")).toBe("0");
    await userEvent.keyboard("{ArrowDown}");
    expect(valueNow("minute")).toBe("0");
  });

  it("a step in seconds (30) steps the second segment; its message names seconds", async () => {
    await render(<Basic granularity="second" step={30} defaultValue="10:00:10" />);
    expect(hiddenInput().validationMessage).toBe("Enter a time in 30-second steps.");
    await userEvent.click(seg("second"));
    await userEvent.keyboard("{ArrowUp}");
    expect(valueNow("second")).toBe("30");
    expect(hiddenInput().value).toBe("10:00:30");
  });

  it("PageUp / PageDown: hour ±2, minute ±15, the day period toggles", async () => {
    await render(<Basic defaultValue="09:30" />);
    await userEvent.click(seg("hour"));
    await userEvent.keyboard("{PageUp}");
    expect(valueNow("hour")).toBe("11");
    await userEvent.keyboard("{PageDown}");
    expect(valueNow("hour")).toBe("9");
    await userEvent.click(seg("minute"));
    await userEvent.keyboard("{PageUp}");
    expect(valueNow("minute")).toBe("45");
    await userEvent.keyboard("{PageDown}{PageDown}");
    expect(valueNow("minute")).toBe("15");
    await userEvent.click(seg("dayPeriod"));
    await userEvent.keyboard("{PageUp}");
    expect(valueNow("dayPeriod")).toBe("1");
    await userEvent.keyboard("{PageDown}");
    expect(valueNow("dayPeriod")).toBe("0");
  });

  it("↑/↓ toggle the day period; a / p set it", async () => {
    const onValueChange = vi.fn();
    await render(<Basic defaultValue="09:30" onValueChange={onValueChange} />);
    await userEvent.click(seg("dayPeriod"));
    await userEvent.keyboard("{ArrowUp}");
    expect(onValueChange).toHaveBeenLastCalledWith("21:30");
    await userEvent.keyboard("{ArrowDown}");
    expect(onValueChange).toHaveBeenLastCalledWith("09:30");
    await type("P");
    expect(onValueChange).toHaveBeenLastCalledWith("21:30");
    await type("a");
    expect(onValueChange).toHaveBeenLastCalledWith("09:30");
  });

  it("Home / End jump to the segment's min / max (the day period AM / PM)", async () => {
    await render(<Basic defaultValue="09:30" />);
    await userEvent.click(seg("hour"));
    await userEvent.keyboard("{End}");
    expect(valueNow("hour")).toBe("12");
    await userEvent.keyboard("{Home}");
    expect(valueNow("hour")).toBe("1");
    await userEvent.click(seg("minute"));
    await userEvent.keyboard("{End}");
    expect(valueNow("minute")).toBe("59");
    await userEvent.keyboard("{Home}");
    expect(valueNow("minute")).toBe("0");
    await userEvent.click(seg("dayPeriod"));
    await userEvent.keyboard("{End}");
    expect(valueNow("dayPeriod")).toBe("1");
    await userEvent.keyboard("{Home}");
    expect(valueNow("dayPeriod")).toBe("0");
  });

  it("Backspace / Delete clear a segment; Backspace on an empty one moves to the previous", async () => {
    await render(<Basic defaultValue="09:30" />);
    await userEvent.click(seg("dayPeriod"));
    await userEvent.keyboard("{Backspace}");
    expect(seg("dayPeriod").textContent).toBe("––");
    expect(focusedType()).toBe("dayPeriod");
    await userEvent.keyboard("{Backspace}");
    expect(focusedType()).toBe("minute");
    expect(valueNow("minute")).toBe("30");
    await userEvent.keyboard("{Delete}");
    expect(seg("minute").textContent).toBe("––");
    expect(focusedType()).toBe("minute");
  });

  it("the literal separator moves to the next segment", async () => {
    await render(<Basic />);
    await userEvent.click(seg("hour"));
    await type("1");
    await type(":");
    expect(focusedType()).toBe("minute");
    expect(valueNow("hour")).toBe("1");
  });

  it("Enter submits the enclosing form; read-only does not", async () => {
    const submitted: (string | null)[] = [];
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted.push(new FormData(event.currentTarget).get("start") as string | null);
        }}
      >
        <Basic name="start" />
        <TimeField aria-label="Locked" locale="en-US" readOnly defaultValue="08:00" />
      </form>,
    );
    const requestSubmit = vi.spyOn(
      document.querySelector("form") as HTMLFormElement,
      "requestSubmit",
    );
    await userEvent.click(seg("hour"));
    await type("930");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => submitted).toEqual(["09:30"]);
    await userEvent.click(page.getByRole("spinbutton", { name: /^hour Locked/ }));
    await userEvent.keyboard("{Enter}");
    await userEvent.click(seg("minute"));
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => submitted.length).toBe(2);
    expect(requestSubmit).toHaveBeenCalledTimes(2);
  });

  it("an Enter that belongs to an IME composition does not submit", async () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    await render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent)}>
        <Basic name="start" defaultValue="09:30" />
      </form>,
    );
    const requestSubmit = vi.spyOn(
      document.querySelector("form") as HTMLFormElement,
      "requestSubmit",
    );
    await userEvent.click(seg("minute"));
    seg("minute").dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }),
    );
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => onSubmit.mock.calls.length).toBe(1);
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("TimeField: ←/→ follow the visual order", () => {
  const lefts = () =>
    segments()
      .map((s) => ({ type: s.dataset.type, left: s.getBoundingClientRect().left }))
      .sort((a, b) => a.left - b.left)
      .map((s) => s.type);

  it("en-US in LTR: hour, minute, AM from left to right; → moves right, clamped", async () => {
    await render(<Basic />);
    expect(lefts()).toEqual(["hour", "minute", "dayPeriod"]);
    await userEvent.click(seg("hour"));
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedType()).toBe("minute");
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedType()).toBe("dayPeriod");
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedType()).toBe("dayPeriod");
    await userEvent.keyboard("{ArrowLeft}");
    expect(focusedType()).toBe("minute");
  });

  it("en-US under dir=rtl: the row still reads hour, minute, AM from left to right", async () => {
    await render(
      <div dir="rtl">
        <Basic />
      </div>,
    );
    expect(getComputedStyle(root()).direction).toBe("rtl");
    expect(lefts()).toEqual(["hour", "minute", "dayPeriod"]);
    await userEvent.click(seg("hour"));
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedType()).toBe("minute");
    await userEvent.keyboard("{ArrowLeft}");
    expect(focusedType()).toBe("hour");
  });

  it("ar-EG under dir=rtl: the period is leftmost, the hour left of the minute", async () => {
    await render(
      <div dir="rtl">
        <TimeField aria-label="الوقت" locale="ar-EG" defaultValue="21:30" />
      </div>,
    );
    const row = root().querySelector("[data-slot=time-field-segments]") as HTMLElement;
    expect(row.getAttribute("dir")).toBe("rtl");
    expect(lefts()).toEqual(["dayPeriod", "hour", "minute"]);
    await userEvent.click(seg("dayPeriod"));
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedType()).toBe("hour");
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedType()).toBe("minute");
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(focusedType()).toBe("dayPeriod");
  });
});

describe("TimeField: value", () => {
  it("clearing a segment of a complete time reports null once; partial input reports nothing", async () => {
    const onValueChange = vi.fn();
    await render(<Basic defaultValue="09:30" onValueChange={onValueChange} />);
    await userEvent.click(seg("minute"));
    await userEvent.keyboard("{Backspace}");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    await userEvent.click(seg("hour"));
    await userEvent.keyboard("{Backspace}");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    await type("4");
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("uncontrolled: keeps its own value from defaultValue", async () => {
    await render(<Basic defaultValue="09:30" />);
    await userEvent.click(seg("hour"));
    await type("4");
    expect(texts()).toEqual(["04", "30", "AM"]);
  });

  it("controlled: follows an external value change", async () => {
    const { rerender } = await render(<Basic value="09:30" />);
    expect(texts()).toEqual(["09", "30", "AM"]);
    await rerender(<Basic value="18:05" />);
    expect(texts()).toEqual(["06", "05", "PM"]);
    await rerender(<Basic value={null} />);
    expect(texts()).toEqual(["––", "––", "––"]);
  });

  it("controlled: a parent that ignores changes resets the segments to its value", async () => {
    const onValueChange = vi.fn();
    await render(<Basic value="09:30" onValueChange={onValueChange} />);
    await userEvent.click(seg("hour"));
    await type("4");
    expect(onValueChange).toHaveBeenLastCalledWith("04:30");
    expect(texts()).toEqual(["09", "30", "AM"]);
  });

  it("controlled: value + onValueChange round trip", async () => {
    function Parent() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <div>
          <Basic value={value} onValueChange={setValue} />
          <output>{value ?? "none"}</output>
        </div>
      );
    }
    const screen = await render(<Parent />);
    await userEvent.click(seg("hour"));
    await type("7");
    await expect.element(screen.getByText("none")).toBeInTheDocument();
    await type("45p");
    await expect.element(screen.getByText("19:45")).toBeInTheDocument();
  });

  it("an unparsable value warns (dev) and is ignored", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await render(<Basic value="9:30" />);
    expect(texts()).toEqual(["––", "––", "––"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"9:30"'));
  });

  it("a value with seconds under minute granularity is shown without them, not reported back", async () => {
    const onValueChange = vi.fn();
    await render(<Basic value="09:30:15" name="t" onValueChange={onValueChange} />);
    expect(texts()).toEqual(["09", "30", "AM"]);
    expect(hiddenInput().value).toBe("09:30");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("second granularity reports HH:mm:ss and pads a value without seconds", async () => {
    const onValueChange = vi.fn();
    await render(<Basic granularity="second" defaultValue="09:30" onValueChange={onValueChange} />);
    expect(texts()).toEqual(["09", "30", "00", "AM"]);
    await userEvent.click(seg("second"));
    await type("45");
    expect(onValueChange).toHaveBeenLastCalledWith("09:30:45");
  });

  it("second granularity defaults the step to 1: any second is valid and ↑ steps by one", async () => {
    await render(<Basic granularity="second" defaultValue="14:05:30" />);
    expect(root().hasAttribute("data-invalid")).toBe(false);
    expect(hiddenInput().validationMessage).toBe("");
    await userEvent.click(seg("second"));
    await userEvent.keyboard("{ArrowUp}");
    expect(valueNow("second")).toBe("31");
  });

  it("pastes a time: '9:30 PM' → 21:30; de-DE '21.30'; garbage is ignored", async () => {
    const onValueChange = vi.fn();
    const { rerender } = await render(<Basic onValueChange={onValueChange} />);
    await userEvent.click(seg("minute"));
    paste(seg("minute"), "9:30 PM");
    await expect.poll(() => texts()).toEqual(["09", "30", "PM"]);
    expect(onValueChange).toHaveBeenLastCalledWith("21:30");
    paste(seg("minute"), "not a time");
    paste(seg("minute"), "25:00");
    paste(seg("minute"), "08:15");
    await expect.poll(() => texts()).toEqual(["08", "15", "AM"]);
    expect(onValueChange).toHaveBeenCalledTimes(2);
    await rerender(<TimeField aria-label="Zeit" locale="de-DE" onValueChange={onValueChange} />);
    await userEvent.click(seg("hour"));
    paste(seg("hour"), "21.30");
    await expect.poll(() => texts()).toEqual(["21", "30"]);
    expect(onValueChange).toHaveBeenLastCalledWith("21:30");
  });

  it("types through beforeinput (mobile keyboards send 'Unidentified' keydowns)", async () => {
    const onValueChange = vi.fn();
    await render(<Basic defaultValue="09:30" onValueChange={onValueChange} />);
    await userEvent.click(seg("hour"));
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
    await expect.poll(focusedType).toBe("minute");
    expect(onValueChange).toHaveBeenLastCalledWith("04:30");
    input("deleteContentBackward", null);
    await expect.poll(() => seg("minute").textContent).toBe("––");
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    expect(input("insertText", "x").defaultPrevented).toBe(true);
    expect(seg("minute").textContent).toBe("––");
  });

  it("types full-width digits from a composing IME (real CDP composition)", async () => {
    const onValueChange = vi.fn();
    await render(<Basic defaultValue="09:30" onValueChange={onValueChange} />);
    await userEvent.click(seg("hour"));
    await cdp().send("Input.imeSetComposition", { text: "４", selectionStart: 1, selectionEnd: 1 });
    await cdp().send("Input.insertText", { text: "４" });
    await expect.poll(focusedType).toBe("minute");
    expect(onValueChange).toHaveBeenLastCalledWith("04:30");
    expect(texts()).toEqual(["04", "30", "AM"]);
  });
});

describe("TimeField: validation", () => {
  const minText = formatTime("09:00", "en-US");
  const maxText = formatTime("17:00", "en-US");

  it("a time before min / after max is invalid with the formatted bound in the message", async () => {
    const { rerender } = await render(<Basic min="09:00" max="17:00" defaultValue="08:30" />);
    expect(root().hasAttribute("data-invalid")).toBe(true);
    for (const s of segments()) expect(s.getAttribute("aria-invalid")).toBe("true");
    expect(hiddenInput().validationMessage).toBe(`Enter a time at or after ${minText}.`);
    await rerender(<Basic key="b" min="09:00" max="17:00" defaultValue="17:30" />);
    expect(hiddenInput().validationMessage).toBe(`Enter a time at or before ${maxText}.`);
    await rerender(<Basic key="c" min="09:00" max="17:00" defaultValue="17:00" />);
    expect(root().hasAttribute("data-invalid")).toBe(false);
    expect(seg("hour").hasAttribute("aria-invalid")).toBe(false);
    expect(hiddenInput().validationMessage).toBe("");
  });

  it("labels override the messages (bounds formatted in the field's cycle)", async () => {
    await render(
      <TimeField
        aria-label="Zeit"
        locale="de-DE"
        min="09:00"
        defaultValue="08:00"
        labels={{ rangeUnderflow: (min) => `Frühestens ${min}` }}
      />,
    );
    expect(hiddenInput().validationMessage).toBe(`Frühestens ${formatTime("09:00", "de-DE")}`);
  });

  it("partial input is 'Enter a complete time.'", async () => {
    await render(<Basic />);
    await userEvent.click(seg("hour"));
    await type("9");
    expect(hiddenInput().validationMessage).toBe("Enter a complete time.");
  });

  it("an overnight min > max warns once and ignores max", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rerender } = await render(<Basic min="22:00" max="02:00" defaultValue="23:00" />);
    await rerender(<Basic min="22:00" max="02:00" defaultValue="23:00" className="x" />);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.lastCall?.[0]).toContain("overnight");
    expect(root().hasAttribute("data-invalid")).toBe(false);
  });

  it("moves an aria-invalid prop onto the segments; shows the danger border", async () => {
    const screen = await render(
      <div>
        <Basic aria-invalid="true" />
        <div data-testid="ref" className="border border-danger" />
      </div>,
    );
    expect(root().hasAttribute("aria-invalid")).toBe(false);
    expect(root().hasAttribute("data-invalid")).toBe(true);
    expect(seg("hour").getAttribute("aria-invalid")).toBe("true");
    expect(getComputedStyle(root()).borderTopColor).toBe(
      getComputedStyle(screen.getByTestId("ref").element()).borderTopColor,
    );
  });
});

function TimeForm({
  children,
  onFormSubmit = () => {},
  validationMode,
}: {
  children: React.ReactNode;
  onFormSubmit?: (values: Record<string, unknown>) => void;
  validationMode?: "onSubmit" | "onBlur" | "onChange";
}) {
  return (
    <Form aria-label="Booking" onFormSubmit={onFormSubmit} validationMode={validationMode}>
      <Field name="start">
        <FieldLabel>Start time</FieldLabel>
        {children}
        <FieldError />
      </Field>
      <Button type="submit">Send</Button>
    </Form>
  );
}

const send = () => userEvent.click(page.getByRole("button", { name: "Send", exact: true }));

describe("TimeField: Form and Field", () => {
  it("name → native FormData start=09:30 (empty when unset)", async () => {
    let data: FormData | null = null;
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <Basic name="start" defaultValue="09:30" />
        <Basic aria-label="Other" name="other" />
        <button type="submit">Save</button>
      </form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => data).not.toBeNull();
    const form = data as unknown as FormData;
    expect(form.get("start")).toBe("09:30");
    expect(form.get("other")).toBe("");
  });

  it("a Field name alone names the native FormData entry (name ?? field.name)", async () => {
    let data: FormData | null = null;
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <Field name="start">
          <FieldLabel>Start time</FieldLabel>
          <TimeField locale="en-US" defaultValue="14:15" />
        </Field>
        <button type="submit">Save</button>
      </form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => data).not.toBeNull();
    expect(Object.fromEntries((data as unknown as FormData).entries())).toEqual({ start: "14:15" });
  });

  it("onFormSubmit reports the value under the Field name; one registered control", async () => {
    const onFormSubmit = vi.fn();
    await render(
      <TimeForm onFormSubmit={onFormSubmit}>
        <TimeField locale="en-US" defaultValue="09:30" />
      </TimeForm>,
    );
    expect(document.querySelectorAll("[data-slot=time-form-control]")).toHaveLength(1);
    await send();
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1));
    expect(onFormSubmit.mock.calls[0]?.[0]).toEqual({ start: "09:30" });
  });

  it("required with an empty field blocks submit and focuses the first segment", async () => {
    const onFormSubmit = vi.fn();
    await render(
      <TimeForm onFormSubmit={onFormSubmit}>
        <TimeField locale="en-US" required />
      </TimeForm>,
    );
    expect(seg("hour").getAttribute("aria-required")).toBe("true");
    await send();
    await expect.element(page.getByText(/fill out this field/i)).toBeVisible();
    expect(onFormSubmit).not.toHaveBeenCalled();
    await expect.poll(() => document.activeElement).toBe(seg("hour"));
    expect(seg("hour").getAttribute("aria-invalid")).toBe("true");
  });

  it("partial input blocks submit with 'Enter a complete time.' and focuses the first segment", async () => {
    const onFormSubmit = vi.fn();
    await render(
      <TimeForm onFormSubmit={onFormSubmit}>
        <TimeField locale="en-US" />
      </TimeForm>,
    );
    await userEvent.click(seg("minute"));
    await type("3");
    await send();
    await expect.element(page.getByText("Enter a complete time.")).toBeVisible();
    expect(onFormSubmit).not.toHaveBeenCalled();
    await expect.poll(() => document.activeElement).toBe(seg("hour"));
  });

  it("a step mismatch blocks submit with its message", async () => {
    await render(
      <TimeForm>
        <TimeField locale="en-US" step={900} defaultValue="09:10" />
      </TimeForm>,
    );
    await send();
    await expect.element(page.getByText("Enter a time in 15-minute steps.")).toBeVisible();
  });

  it("the Field label names the group, clicking it focuses the first empty segment; the description describes it", async () => {
    await render(
      <Field>
        <FieldLabel>Start time</FieldLabel>
        <TimeField locale="en-US" defaultValue={null} />
        <FieldDescription>When the meeting starts.</FieldDescription>
      </Field>,
    );
    const group = page.getByRole("group", { name: "Start time" });
    await expect.element(group).toHaveAccessibleDescription("When the meeting starts.");
    const label = document.querySelector("[data-slot=field-label]") as HTMLLabelElement;
    expect(label.htmlFor).toBe("");
    expect(seg("hour").getAttribute("aria-labelledby")).toBe(`${seg("hour").id} ${label.id}`);
    await userEvent.click(label);
    expect(focusedType()).toBe("hour");
    await type("9");
    await userEvent.click(label);
    expect(focusedType()).toBe("minute");
  });

  it("a disabled Field disables it; an invalid Field marks it", async () => {
    await render(
      <div>
        <Field disabled>
          <FieldLabel>Disabled</FieldLabel>
          <TimeField locale="en-US" />
        </Field>
        <Field invalid>
          <FieldLabel>Invalid</FieldLabel>
          <TimeField locale="en-US" />
        </Field>
      </div>,
    );
    const [disabled, invalid] = [
      ...document.querySelectorAll<HTMLElement>("[data-slot=time-field]"),
    ];
    expect(disabled?.hasAttribute("data-disabled")).toBe(true);
    for (const s of segments(disabled)) expect(s.hasAttribute("tabindex")).toBe(false);
    expect(invalid?.hasAttribute("data-invalid")).toBe(true);
    expect(seg("hour", invalid).getAttribute("aria-invalid")).toBe("true");
  });

  it("form reaches an outside <form id>", async () => {
    let data: FormData | null = null;
    await render(
      <div>
        <form
          id="outside"
          onSubmit={(event) => {
            event.preventDefault();
            data = new FormData(event.currentTarget);
          }}
        >
          <button type="submit">Save</button>
        </form>
        <Basic name="start" form="outside" defaultValue="10:15" />
      </div>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => data).not.toBeNull();
    expect((data as unknown as FormData).get("start")).toBe("10:15");
  });

  it("onBlur validation runs when focus leaves the group, not between segments", async () => {
    await render(
      <div>
        <TimeForm validationMode="onBlur">
          <TimeField locale="en-US" />
        </TimeForm>
        <button type="button">after</button>
      </div>,
    );
    await userEvent.click(seg("hour"));
    await type("9");
    expect(focusedType()).toBe("minute");
    await userEvent.tab();
    expect(focusedType()).toBe("dayPeriod");
    await expect.element(page.getByText("Enter a complete time.")).not.toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "after" }));
    await expect.element(page.getByText("Enter a complete time.")).toBeVisible();
  });
});

describe("TimeField: states", () => {
  it("disabled: no Tab stops, aria-disabled segments, opacity 0.5, not-allowed cursor", async () => {
    await render(
      <div>
        <Basic disabled defaultValue="09:30" />
        <button type="button">after</button>
      </div>,
    );
    const element = root();
    expect(element.hasAttribute("data-disabled")).toBe(true);
    expect(getComputedStyle(element).opacity).toBe("0.5");
    expect(getComputedStyle(element).cursor).toBe("not-allowed");
    for (const s of segments()) {
      expect(s.hasAttribute("tabindex")).toBe(false);
      expect(s.getAttribute("aria-disabled")).toBe("true");
    }
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe("after");
  });

  it("read-only: focusable and navigable, keys and paste never change the value", async () => {
    const onValueChange = vi.fn();
    await render(<Basic readOnly defaultValue="09:30" onValueChange={onValueChange} />);
    expect(root().hasAttribute("data-readonly")).toBe(true);
    const prevented: Record<string, boolean> = {};
    const listener = (event: KeyboardEvent) => {
      prevented[event.key] = event.defaultPrevented;
    };
    window.addEventListener("keydown", listener);
    try {
      await userEvent.click(seg("hour"));
      expect(seg("hour").getAttribute("aria-readonly")).toBe("true");
      for (const key of ["ArrowUp", "PageDown", "Home", "End", "Backspace"]) {
        await userEvent.keyboard(`{${key}}`);
      }
      await type("4p");
      paste(seg("hour"), "10:00");
    } finally {
      window.removeEventListener("keydown", listener);
    }
    expect(prevented).toMatchObject({ ArrowUp: true, PageDown: true, Home: true, End: true });
    expect(texts()).toEqual(["09", "30", "AM"]);
    expect(onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedType()).toBe("minute");
  });

  it("clicking the padding or a literal focuses the first empty segment (else the first)", async () => {
    await render(<Basic className="w-80" />);
    const element = root();
    const box = element.getBoundingClientRect();
    await userEvent.click(element, { position: { x: box.width - 4, y: box.height / 2 } });
    expect(focusedType()).toBe("hour");
    await type("9");
    await userEvent.click(seg("dayPeriod"));
    await userEvent.click(element.querySelector("[data-slot=time-field-literal]") as HTMLElement);
    expect(focusedType()).toBe("minute");
  });

  it("sits at the Input heights per size", async () => {
    await render(
      <div className="flex flex-col gap-2">
        {(["sm", "md", "lg"] as const).map((size) => (
          <div key={size} className="flex gap-2">
            <Input aria-label={`input-${size}`} size={size} />
            <TimeField aria-label={`time-${size}`} size={size} locale="en-US" />
          </div>
        ))}
      </div>,
    );
    for (const [size, height] of [
      ["sm", 32],
      ["md", 40],
      ["lg", 48],
    ] as const) {
      const input = page.getByRole("textbox", { name: `input-${size}` }).element();
      const time = page.getByRole("group", { name: `time-${size}` }).element();
      expect(time.getBoundingClientRect().height).toBe(height);
      expect(time.getAttribute("data-size")).toBe(size);
      expect(getComputedStyle(time).paddingLeft).toBe(getComputedStyle(input).paddingLeft);
      expect(getComputedStyle(time).fontSize).toBe(getComputedStyle(input).fontSize);
    }
  });

  it("starts its text where Input's text starts (LTR)", async () => {
    await render(
      <div className="flex flex-col gap-2">
        <Input aria-label="input" />
        <Basic defaultValue="09:30" />
      </div>,
    );
    const input = page.getByRole("textbox", { name: "input" }).element();
    const i = getComputedStyle(input);
    const expected =
      input.getBoundingClientRect().left +
      Number.parseFloat(i.borderLeftWidth) +
      Number.parseFloat(i.paddingLeft);
    const range = document.createRange();
    range.selectNodeContents(seg("hour").firstChild as Node);
    expect(range.getBoundingClientRect().left).toBeCloseTo(expected, 0);
  });
});

describe("TimeField: focus, forced colors and motion", () => {
  it("Tab focuses the first segment: the group shows a solid 1px ring, the segment the primary fill", async () => {
    const screen = await render(
      <div>
        <Basic />
        <span data-testid="primary" className="bg-primary text-primary-foreground" />
      </div>,
    );
    expect(getComputedStyle(root()).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(focusedType()).toBe("hour");
    const style = getComputedStyle(root());
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("1px");
    const ref = getComputedStyle(screen.getByTestId("primary").element());
    expect(getComputedStyle(seg("hour")).backgroundColor).toBe(ref.backgroundColor);
    expect(getComputedStyle(seg("hour")).color).toBe(ref.color);
    // Every segment is a Tab stop with the same ring.
    for (const expected of ["minute", "dayPeriod"]) {
      await userEvent.tab();
      expect(focusedType()).toBe(expected);
      expect(getComputedStyle(root()).outlineStyle).toBe("solid");
    }
  });

  it("forced colors: no ring until focused, then a Highlight ring and a Highlight / HighlightText segment", async () => {
    await render(<Basic defaultValue="09:30" />);
    await emulateForcedColors(true);
    expect(getComputedStyle(root()).outlineStyle).toBe("none");
    await userEvent.tab();
    const group = getComputedStyle(root());
    expect(group.outlineStyle).toBe("solid");
    expect(group.outlineColor).toBe(systemColor("Highlight"));
    const hour = getComputedStyle(seg("hour"));
    expect(hour.backgroundColor).toBe(systemColor("Highlight"));
    expect(hour.color).toBe(systemColor("HighlightText"));
    expect(hour.forcedColorAdjust).toBe("none");
    expect(getComputedStyle(seg("minute")).forcedColorAdjust).toBe("auto");
  });

  it("forced colors: an invalid, focused field still rings Highlight", async () => {
    await render(<Basic min="10:00" defaultValue="09:30" />);
    await emulateForcedColors(true);
    await userEvent.tab();
    expect(getComputedStyle(root()).outlineColor).toBe(systemColor("Highlight"));
  });

  it("reduced motion: the group has no transition", async () => {
    await render(<Basic />);
    expect(getComputedStyle(root()).transitionProperty).not.toBe("none");
    await emulateReducedMotion(true);
    expect(getComputedStyle(root()).transitionProperty).toBe("none");
  });
});

describe("TimeField: SSR and hydration", () => {
  const originalLang = document.documentElement.lang;
  afterEach(() => {
    document.documentElement.lang = originalLang;
  });

  async function hydrate(html: string, element: React.ReactNode) {
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const root = hydrateRoot(container, element, { onRecoverableError });
    await expect.poll(() => container.querySelector("[data-slot=time-field]")).not.toBeNull();
    // Let React finish (and report) the hydration pass.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    consoleError.mockRestore();
    return { container, root, onRecoverableError };
  }

  it("with locale: the server HTML has the three segments and hydration raises no error", async () => {
    const element = <TimeField aria-label="Start time" locale="en-US" defaultValue="09:30" />;
    document.documentElement.lang = "de-DE";
    const html = renderToString(element);
    expect(html.match(/data-slot="time-field-segment"/g)).toHaveLength(3);
    const { container, root, onRecoverableError } = await hydrate(html, element);
    try {
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(segments(container)).toHaveLength(3);
    } finally {
      root.unmount();
      container.remove();
    }
  });

  it("without locale: an en-US server and a de-DE client disagree on the segment count (hydration error)", async () => {
    const element = <TimeField aria-label="Start time" defaultValue="09:30" />;
    document.documentElement.lang = "en-US";
    const html = renderToString(element);
    expect(html.match(/data-slot="time-field-segment"/g)).toHaveLength(3);
    document.documentElement.lang = "de-DE";
    const { container, root, onRecoverableError } = await hydrate(html, element);
    try {
      await expect.poll(() => onRecoverableError.mock.calls.length).toBeGreaterThan(0);
      // React recovers by rendering on the client: de-DE's two segments.
      await expect.poll(() => segments(container).length).toBe(2);
    } finally {
      root.unmount();
      container.remove();
    }
  });
});

describe("TimeField: accessibility", () => {
  it.each(["light", "dark"] as const)("has no axe violations (%s)", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    const screen = await render(
      <div className="flex flex-col gap-4 bg-background p-4">
        <Field>
          <FieldLabel>Start time</FieldLabel>
          <TimeField locale="en-US" defaultValue="09:30" />
          <FieldDescription>When the meeting starts.</FieldDescription>
        </Field>
        <TimeField aria-label="Empty" locale="en-US" />
        <TimeField aria-label="Invalid" locale="en-US" min="10:00" defaultValue="09:30" />
        <TimeField aria-label="Disabled" locale="en-US" disabled defaultValue="09:30" />
        <TimeField aria-label="Read-only" locale="en-US" readOnly defaultValue="09:30" />
        <TimeField
          aria-label="Seconds"
          locale="de-DE"
          granularity="second"
          defaultValue="09:30:15"
        />
        <div dir="rtl">
          <TimeField aria-label="الوقت" locale="ar-EG" defaultValue="21:30" />
        </div>
      </div>,
    );
    await userEvent.click(seg("minute"));
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
  });
});
