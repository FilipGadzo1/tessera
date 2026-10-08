import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  emulateForcedColors,
  emulateReducedMotion,
  resetEmulatedMedia,
  systemColor,
} from "../../../test/emulation";
import { auditOpenOverlay, inlineOffsets, waitForPopupSettled } from "../../../test/overlay";
import { formatTime } from "../../lib/time";
import { Button } from "../button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "../dialog";
import { Field, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import { Input } from "../input";
import { TimePicker, type TimePickerProps } from "./time-picker";

afterEach(async () => {
  document.documentElement.classList.remove("dark");
  await resetEmulatedMedia();
  vi.restoreAllMocks();
});

type SegmentType = "hour" | "minute" | "second" | "dayPeriod";

const t = (value: string) => formatTime(value, "en-US");
const shell = () =>
  document.querySelector<HTMLElement>("[data-slot=time-picker-editable]") as HTMLElement;
const group = () => document.querySelector<HTMLElement>("[data-slot=time-field]") as HTMLElement;
const iconButton = () =>
  document.querySelector<HTMLButtonElement>("[data-slot=time-picker-trigger]") as HTMLButtonElement;
const popup = () => document.querySelector<HTMLElement>("[data-slot=time-picker-content]");
const list = () =>
  document.querySelector<HTMLElement>("[data-slot=time-picker-list]") as HTMLElement;
const options = () => [...document.querySelectorAll<HTMLElement>("[data-slot=time-picker-option]")];
const option = (value: string) =>
  document.querySelector<HTMLElement>(
    `[data-slot=time-picker-option][data-value="${value}"]`,
  ) as HTMLElement;
const focusedValue = () => document.activeElement?.getAttribute("data-value") ?? null;
const seg = (type: SegmentType) =>
  document.querySelector<HTMLElement>(
    `[data-slot=time-field-segment][data-type=${type}]`,
  ) as HTMLElement;
const texts = () =>
  [...document.querySelectorAll("[data-slot=time-field-segment]")].map((s) => s.textContent);
const dialog = () => page.getByRole("dialog", { name: "Choose a time" });

/** Sends one key at a time: focus may move after each. */
async function type(keys: string) {
  for (const key of keys) await userEvent.keyboard(key);
}

async function openList() {
  await userEvent.click(iconButton());
  await expect.element(dialog()).toBeVisible();
  const element = popup() as HTMLElement;
  await waitForPopupSettled(element);
  return element;
}

function Picker(props: TimePickerProps) {
  // Padding leaves room on every side, so the popup never flips.
  return (
    <div className="p-16">
      <TimePicker aria-label="Start time" locale="en-US" {...props} />
    </div>
  );
}

describe("TimePicker: the shell", () => {
  it("renders a TimeField group and a clock icon button inside the field's border, at its end", async () => {
    await render(<Picker />);
    await expect.element(page.getByRole("group", { name: "Start time" })).toBeInTheDocument();
    expect(shell()).not.toBeNull();
    expect(texts()).toEqual(["––", "––", "––"]);
    const button = iconButton();
    expect(button.tagName).toBe("BUTTON");
    expect(button.type).toBe("button");
    expect(button.getAttribute("aria-label")).toBe("Choose time");
    const icon = button.querySelector("svg") as SVGElement;
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.getAttribute("data-slot")).toBe("time-picker-icon");
    const field = group().getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    expect(rect.right).toBeLessThanOrEqual(field.right);
    expect(rect.left).toBeGreaterThan(seg("dayPeriod").getBoundingClientRect().right);
    expect(rect.top).toBeGreaterThanOrEqual(field.top);
    expect(rect.bottom).toBeLessThanOrEqual(field.bottom);
    expect(Math.round(field.right - rect.right)).toBeLessThanOrEqual(6);
  });

  it("under dir=rtl, the icon button sits inside the field at its inline end (left)", async () => {
    await render(
      <div dir="rtl">
        <Picker />
      </div>,
    );
    const button = iconButton();
    const field = group().getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    expect(getComputedStyle(button).direction).toBe("rtl");
    expect(rect.left).toBeGreaterThanOrEqual(field.left);
    expect(Math.round(rect.left - field.left)).toBeLessThanOrEqual(6);
    // The en-US row reads hour, minute, AM left to right; the button is left of all of it.
    expect(rect.right).toBeLessThan(seg("hour").getBoundingClientRect().left);
    expect(rect.top).toBeGreaterThanOrEqual(field.top);
    expect(rect.bottom).toBeLessThanOrEqual(field.bottom);
    expect(Number.parseFloat(getComputedStyle(group()).paddingLeft)).toBeGreaterThanOrEqual(
      rect.width,
    );
  });

  it("types as a TimeField while closed", async () => {
    const onValueChange = vi.fn();
    await render(<Picker onValueChange={onValueChange} />);
    await userEvent.click(seg("hour"));
    await type("930");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith("09:30");
    await expect.element(dialog()).not.toBeInTheDocument();
  });

  it("labels localise the button, the popup and the list", async () => {
    await render(
      <Picker
        min="09:00"
        max="10:00"
        labels={{ open: "Uhrzeit wählen", dialog: "Uhrzeit", list: "Zeiten" }}
      />,
    );
    await userEvent.click(page.getByRole("button", { name: "Uhrzeit wählen", exact: true }));
    await expect.element(page.getByRole("dialog", { name: "Uhrzeit" })).toBeVisible();
    await expect.element(page.getByRole("listbox", { name: "Zeiten" })).toBeInTheDocument();
  });

  it("sits at the Input heights per size, the button centred inside the border", async () => {
    await render(
      <div className="flex flex-col gap-2">
        {(["sm", "md", "lg"] as const).map((size) => (
          <div key={size} className="flex gap-2">
            <Input aria-label={`input-${size}`} size={size} />
            <div className="w-56">
              <TimePicker aria-label={`time-${size}`} size={size} locale="en-US" />
            </div>
          </div>
        ))}
      </div>,
    );
    for (const size of ["sm", "md", "lg"] as const) {
      const input = page.getByRole("textbox", { name: `input-${size}` }).element();
      const field = page.getByRole("group", { name: `time-${size}` }).element();
      const r = field.getBoundingClientRect();
      expect(r.height).toBe(input.getBoundingClientRect().height);
      const button = field.parentElement?.querySelector("button") as HTMLElement;
      const b = button.getBoundingClientRect();
      expect(Math.abs(b.top - r.top - (r.bottom - b.bottom))).toBeLessThanOrEqual(1);
      expect(b.height).toBeLessThan(r.height);
    }
  });
});

describe("TimePicker: the slot list", () => {
  it("opens a dialog 'Choose a time' holding a listbox 'Times' of formatted slots", async () => {
    await render(<Picker min="09:00" max="11:00" slotStep={30} />);
    await openList();
    const listbox = page.getByRole("listbox", { name: "Times" });
    await expect.element(listbox).toBeInTheDocument();
    expect(dialog().element().contains(list())).toBe(true);
    expect(options().map((o) => o.textContent)).toEqual(
      ["09:00", "09:30", "10:00", "10:30", "11:00"].map(t),
    );
    expect(options().map((o) => o.getAttribute("role"))).toEqual(Array(5).fill("option"));
    expect(options().map((o) => o.getAttribute("aria-selected"))).toEqual(Array(5).fill("false"));
    const listId = options()[0]?.id.replace(/-09:00$/, "");
    expect(options().map((o) => o.id)).toEqual(
      ["09:00", "09:30", "10:00", "10:30", "11:00"].map((v) => `${listId}-${v}`),
    );
    // Roving: one option is the Tab stop.
    expect(options().filter((o) => o.tabIndex === 0)).toHaveLength(1);
  });

  it("step 3600 keeps the whole hours; the default slotStep is 30 minutes over the day", async () => {
    const screen = await render(<Picker min="09:00" max="11:00" step={3600} />);
    await openList();
    expect(options().map((o) => o.dataset.value)).toEqual(["09:00", "10:00", "11:00"]);
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await screen.rerender(<Picker />);
    await openList();
    expect(options()).toHaveLength(48);
    expect(options().at(-1)?.dataset.value).toBe("23:30");
  });

  it.each([
    ["the selected option", "10:00", "10:00"],
    ["the first slot after the value", "10:10", "10:30"],
    ["the last slot for a value later than every slot", "12:00", "11:00"],
    ["the first slot with no value", null, "09:00"],
  ])("opening focuses %s", async (_, value, expected) => {
    await render(<Picker min="09:00" max="11:00" defaultValue={value} />);
    await openList();
    await expect.poll(focusedValue).toBe(expected);
    const focused = option(expected);
    expect(focused.hasAttribute("data-highlighted")).toBe(true);
    expect(focused.tabIndex).toBe(0);
    if (value === expected) {
      expect(focused.getAttribute("aria-selected")).toBe("true");
      expect(focused.hasAttribute("data-selected")).toBe(true);
      expect(focused.querySelector("[data-slot=time-picker-option-indicator] svg")).not.toBeNull();
    } else {
      expect(options().filter((o) => o.getAttribute("aria-selected") === "true")).toHaveLength(0);
    }
  });

  it("scrolls the focused option into view in a long list", async () => {
    await render(<Picker defaultValue="20:00" />);
    await openList();
    await expect.poll(focusedValue).toBe("20:00");
    const box = list().getBoundingClientRect();
    expect(list().scrollHeight).toBeGreaterThan(list().clientHeight);
    await expect
      .poll(() => {
        const r = option("20:00").getBoundingClientRect();
        return r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
      })
      .toBe(true);
    // `block: "nearest"` from the top: the option sits at the list's bottom edge (the popup's own
    // initial focus would centre it).
    const r = option("20:00").getBoundingClientRect();
    expect(Math.abs(box.bottom - r.bottom)).toBeLessThanOrEqual(1);
  });

  it("follows the field: a typed value is selected next time it opens", async () => {
    await render(<Picker min="09:00" max="11:00" />);
    await userEvent.click(seg("hour"));
    await type("1030");
    await openList();
    await expect.poll(focusedValue).toBe("10:30");
    expect(option("10:30").getAttribute("aria-selected")).toBe("true");
  });

  it("an empty slot list shows the status (localisable); the button stays enabled", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const screen = await render(<Picker slotStep={0} />);
    expect(iconButton().disabled).toBe(false);
    await openList();
    expect(warn).toHaveBeenCalled();
    expect(document.querySelector("[role=listbox]")).toBeNull();
    await expect.element(page.getByRole("status")).toHaveTextContent("No times available");
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await screen.rerender(<Picker slotStep={0} labels={{ noTimes: "Keine Zeiten" }} />);
    await openList();
    await expect.element(page.getByRole("status")).toHaveTextContent("Keine Zeiten");
  });

  it("an overnight min > max ignores max, as the field does", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await render(<Picker min="22:00" max="02:00" />);
    await openList();
    expect(options().map((o) => o.dataset.value)).toEqual(["22:00", "22:30", "23:00", "23:30"]);
  });
});

describe("TimePicker: keys", () => {
  it("↓ / ↑ (no wrap), Home / End, PageDown / PageUp ±5 (clamped) move a roving focus", async () => {
    await render(<Picker slotStep={60} />);
    await openList();
    await expect.poll(focusedValue).toBe("00:00");
    const steps: [string, string][] = [
      ["{ArrowUp}", "00:00"],
      ["{ArrowDown}", "01:00"],
      ["{PageDown}", "06:00"],
      ["{End}", "23:00"],
      ["{ArrowDown}", "23:00"],
      ["{PageDown}", "23:00"],
      ["{PageUp}", "18:00"],
      ["{ArrowUp}", "17:00"],
      ["{Home}", "00:00"],
      ["{PageUp}", "00:00"],
    ];
    for (const [key, expected] of steps) {
      await userEvent.keyboard(key);
      expect(focusedValue(), key).toBe(expected);
      expect(
        options()
          .filter((o) => o.tabIndex === 0)
          .map((o) => o.dataset.value),
      ).toEqual([expected]);
      expect(options().filter((o) => o.hasAttribute("data-highlighted"))).toEqual([
        option(expected),
      ]);
    }
  });

  it("Enter on the 10:30 option picks it: the segments show it, the popup closes, focus is on the icon button", async () => {
    const onValueChange = vi.fn();
    await render(
      <Picker min="09:00" max="11:00" defaultValue="10:00" onValueChange={onValueChange} />,
    );
    await openList();
    await expect.poll(focusedValue).toBe("10:00");
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("10:30");
    expect(texts()).toEqual(["10", "30", "AM"]);
    await expect.poll(() => document.activeElement).toBe(iconButton());
  });

  it("picking the selected slot reports no change; the popup still closes and focus returns", async () => {
    const onValueChange = vi.fn();
    await render(
      <Picker min="09:00" max="11:00" defaultValue="10:00" onValueChange={onValueChange} />,
    );
    await openList();
    await expect.poll(focusedValue).toBe("10:00");
    await userEvent.keyboard("{Enter}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(iconButton());
    expect(onValueChange).not.toHaveBeenCalled();
    expect(texts()).toEqual(["10", "00", "AM"]);
  });

  it("Space picks too; a Space still held when focus returns does not reopen the popup", async () => {
    const onValueChange = vi.fn();
    await render(<Picker min="09:00" max="11:00" onValueChange={onValueChange} />);
    await openList();
    await expect.poll(focusedValue).toBe("09:00");
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("[Space>]");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(iconButton());
    // The release lands on the icon button, but its press started elsewhere: no click.
    await userEvent.keyboard("[/Space]");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("09:30");
    await expect.poll(() => document.activeElement).toBe(iconButton());
    expect(document.querySelector("[data-slot=time-picker-content]")).toBeNull();
  });

  it("opens from the keyboard: Tab to the button and Enter", async () => {
    await render(<Picker min="09:00" max="11:00" defaultValue="09:30" />);
    await userEvent.click(seg("dayPeriod"));
    await userEvent.tab();
    expect(document.activeElement).toBe(iconButton());
    await userEvent.keyboard("{Enter}");
    await expect.element(dialog()).toBeVisible();
    await expect.poll(focusedValue).toBe("09:30");
  });

  it("Escape closes with no change and returns focus to the icon button", async () => {
    const onValueChange = vi.fn();
    await render(
      <Picker min="09:00" max="11:00" defaultValue="10:00" onValueChange={onValueChange} />,
    );
    await openList();
    await expect.poll(focusedValue).toBe("10:00");
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(iconButton());
    expect(texts()).toEqual(["10", "00", "AM"]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("Tab leaves the list and closes the popup", async () => {
    await render(
      <div>
        <Picker min="09:00" max="11:00" />
        <Input aria-label="After" />
      </div>,
    );
    await openList();
    await expect.poll(focusedValue).toBe("09:00");
    await userEvent.tab();
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(document.activeElement?.closest("[data-slot=time-picker-content]")).toBeNull();
  });

  it("Escape is layered inside a Dialog: the first closes the list, the second the Dialog", async () => {
    await render(
      <Dialog>
        <DialogTrigger render={<Button />}>Edit shift</DialogTrigger>
        <DialogContent>
          <DialogTitle>Edit shift</DialogTitle>
          <DialogDescription>Choose a start time.</DialogDescription>
          <TimePicker aria-label="Start time" locale="en-US" min="09:00" max="11:00" />
        </DialogContent>
      </Dialog>,
    );
    await userEvent.click(page.getByRole("button", { name: "Edit shift" }));
    const editDialog = page.getByRole("dialog", { name: "Edit shift" });
    await expect.element(editDialog).toBeVisible();
    await openList();
    await expect.poll(focusedValue).toBe("09:00");
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.element(editDialog).toBeVisible();
    await expect.poll(() => document.activeElement).toBe(iconButton());
    await userEvent.keyboard("{Escape}");
    await expect.element(editDialog).not.toBeInTheDocument();
    await expect
      .poll(() => document.activeElement)
      .toBe(page.getByRole("button", { name: "Edit shift" }).element());
  });
});

describe("TimePicker: pointer", () => {
  it("hover focuses an option (data-highlighted); a click selects and closes", async () => {
    const onValueChange = vi.fn();
    await render(<Picker min="09:00" max="11:00" onValueChange={onValueChange} />);
    await openList();
    await expect.poll(focusedValue).toBe("09:00");
    await userEvent.hover(option("10:00"));
    await expect.poll(focusedValue).toBe("10:00");
    expect(option("10:00").hasAttribute("data-highlighted")).toBe(true);
    expect(option("09:00").hasAttribute("data-highlighted")).toBe(false);
    await userEvent.click(option("10:30"));
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(onValueChange).toHaveBeenCalledWith("10:30");
    expect(texts()).toEqual(["10", "30", "AM"]);
  });
});

describe("TimePicker: second granularity", () => {
  it("lists minute slots and picking reports HH:mm:ss", async () => {
    const onValueChange = vi.fn();
    await render(
      <Picker
        granularity="second"
        min="09:00"
        max="11:00"
        defaultValue="10:00:00"
        onValueChange={onValueChange}
      />,
    );
    await openList();
    await expect.poll(focusedValue).toBe("10:00");
    expect(option("10:00").getAttribute("aria-selected")).toBe("true");
    expect(option("10:00").textContent).toBe(t("10:00"));
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("10:30:00");
    expect(texts()).toEqual(["10", "30", "00", "AM"]);
  });

  it("a min off the whole minute lists slots on its seconds, shown with them", async () => {
    const onValueChange = vi.fn();
    await render(
      <Picker granularity="second" min="09:00:30" max="10:00" onValueChange={onValueChange} />,
    );
    await openList();
    expect(options().map((o) => o.dataset.value)).toEqual(["09:00:30", "09:30:30"]);
    expect(options().map((o) => o.textContent)).toEqual(
      ["09:00:30", "09:30:30"].map((v) => formatTime(v, "en-US", { granularity: "second" })),
    );
    await expect.poll(focusedValue).toBe("09:00:30");
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("09:30:30");
    expect(texts()).toEqual(["09", "30", "30", "AM"]);
  });
});

describe("TimePicker: controlled", () => {
  it("controlled open: the icon button asks; the parent decides", async () => {
    const onOpenChange = vi.fn();
    const screen = await render(<Picker open={false} onOpenChange={onOpenChange} />);
    await userEvent.click(iconButton());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    await expect.element(dialog()).not.toBeInTheDocument();
    await screen.rerender(<Picker open onOpenChange={onOpenChange} />);
    await expect.element(dialog()).toBeVisible();
  });

  it("defaultOpen opens it initially, focusing the first slot", async () => {
    await render(<Picker defaultOpen min="09:00" max="11:00" />);
    await expect.element(dialog()).toBeVisible();
    await expect.poll(focusedValue).toBe("09:00");
  });

  it("controlled value: follows the parent, and a parent that ignores a pick keeps its value", async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <Picker min="09:00" max="11:00" value="09:30" onValueChange={onValueChange} />,
    );
    expect(texts()).toEqual(["09", "30", "AM"]);
    await screen.rerender(
      <Picker min="09:00" max="11:00" value="10:00" onValueChange={onValueChange} />,
    );
    expect(texts()).toEqual(["10", "00", "AM"]);
    await openList();
    await userEvent.click(option("11:00"));
    expect(onValueChange).toHaveBeenCalledWith("11:00");
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(texts()).toEqual(["10", "00", "AM"]);
  });

  it("controlled value + onValueChange round trip", async () => {
    function Controlled() {
      const [value, setValue] = useState<string | null>("09:00");
      return (
        <>
          <Picker min="09:00" max="11:00" value={value} onValueChange={setValue} />
          <output data-testid="echo">{value ?? "none"}</output>
        </>
      );
    }
    await render(<Controlled />);
    await openList();
    await userEvent.click(option("10:30"));
    await expect.element(page.getByTestId("echo")).toHaveTextContent("10:30");
    expect(texts()).toEqual(["10", "30", "AM"]);
  });
});

describe("TimePicker: Field and Form", () => {
  function FormUi(props: { onFormSubmit?: (values: unknown) => void; required?: boolean }) {
    return (
      <div className="p-16">
        <Form aria-label="Shift" onFormSubmit={props.onFormSubmit}>
          <Field name="start">
            <FieldLabel>Start time</FieldLabel>
            <TimePicker locale="en-US" min="09:00" max="11:00" required={props.required} />
            <FieldError />
          </Field>
          <Button type="submit">Send</Button>
        </Form>
      </div>
    );
  }
  const send = () => userEvent.click(page.getByRole("button", { name: "Send" }));

  it("the Field label names the group; clicking it focuses the first segment", async () => {
    await render(<FormUi />);
    await expect.element(page.getByRole("group", { name: "Start time" })).toBeInTheDocument();
    await userEvent.click(document.querySelector("[data-slot=field-label]") as HTMLElement);
    expect(document.activeElement).toBe(seg("hour"));
  });

  it("one registered control and one hidden input with the popup used; onFormSubmit reports the pick", async () => {
    const onFormSubmit = vi.fn();
    await render(<FormUi required onFormSubmit={onFormSubmit} />);
    await send();
    await expect.poll(() => document.activeElement).toBe(seg("hour"));
    expect(onFormSubmit).not.toHaveBeenCalled();
    await openList();
    await userEvent.click(option("10:30"));
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(document.querySelectorAll("[data-slot=time-form-control]")).toHaveLength(1);
    expect(document.querySelectorAll("input").length).toBe(1);
    await send();
    await expect.poll(() => onFormSubmit.mock.calls.length).toBe(1);
    expect(onFormSubmit.mock.calls[0]?.[0]).toEqual({ start: "10:30" });
  });

  it("native FormData has one entry for the name after a pick", async () => {
    let data: FormData | null = null;
    await render(
      <form
        className="p-16"
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <TimePicker aria-label="Start" name="start" locale="en-US" min="09:00" max="11:00" />
        <button type="submit">Save</button>
      </form>,
    );
    await openList();
    await userEvent.click(option("09:30"));
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => data).not.toBeNull();
    expect((data as unknown as FormData).getAll("start")).toEqual(["09:30"]);
  });

  it("validationMode onBlur: the field, its icon button and the popup are one boundary", async () => {
    await render(
      <div className="p-16">
        <Form aria-label="Shift" validationMode="onBlur">
          <Field name="start">
            <FieldLabel>Start time</FieldLabel>
            <TimePicker locale="en-US" min="09:00" max="11:00" />
            <FieldError />
          </Field>
          <Input aria-label="After" />
        </Form>
      </div>,
    );
    const incomplete = page.getByText("Enter a complete time.");
    await userEvent.click(seg("hour"));
    await type("1");
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

  it("disabled: the segments leave the Tab order and the icon button is disabled", async () => {
    await render(<Picker disabled />);
    expect(iconButton().disabled).toBe(true);
    expect(seg("hour").tabIndex).toBe(-1);
    await userEvent.click(iconButton(), { force: true });
    await expect.element(dialog()).not.toBeInTheDocument();
  });

  it("read-only: the segments stay focusable, the icon button is disabled", async () => {
    await render(<Picker readOnly defaultValue="10:00" />);
    expect(iconButton().disabled).toBe(true);
    await userEvent.click(seg("hour"));
    expect(document.activeElement).toBe(seg("hour"));
    await userEvent.keyboard("{ArrowUp}");
    expect(texts()).toEqual(["10", "00", "AM"]);
  });

  it("a disabled Field disables it", async () => {
    await render(
      <Field disabled>
        <FieldLabel>Start time</FieldLabel>
        <TimePicker locale="en-US" />
      </Field>,
    );
    expect(iconButton().disabled).toBe(true);
    expect(seg("hour").tabIndex).toBe(-1);
  });
});

describe("TimePicker: direction", () => {
  it.each(["ltr", "rtl"] as const)(
    "dir=%s: the popup's start edge lines up with the shell's; indicators sit at the inline start",
    async (dir) => {
      await render(
        <div dir={dir}>
          <Picker min="09:00" max="11:00" defaultValue="10:00" />
        </div>,
      );
      const element = await openList();
      const s = shell().getBoundingClientRect();
      const p = element.getBoundingClientRect();
      if (dir === "rtl") expect(Math.abs(p.right - s.right)).toBeLessThanOrEqual(1);
      else expect(Math.abs(p.left - s.left)).toBeLessThanOrEqual(1);
      const selected = option("10:00");
      const indicator = selected.querySelector(
        "[data-slot=time-picker-option-indicator]",
      ) as Element;
      expect(inlineOffsets(selected, { indicator, text: t("10:00") }, dir)).toEqual({
        indicator: 8,
        text: 32,
        trailing: undefined,
      });
    },
  );
});

/** The left edge of the character at `index` of `element`'s first text node (deep). */
function charLeft(element: Element, index: number) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const node = walker.nextNode() as Text;
  const range = document.createRange();
  range.setStart(node, index);
  range.setEnd(node, index + 1);
  return range.getBoundingClientRect().left;
}

describe("TimePicker: option text direction", () => {
  it("an en-US option reads '10:00 AM' (digits first) in an RTL page, as the field's row", async () => {
    await render(
      <div dir="rtl">
        <Picker min="09:00" max="11:00" />
      </div>,
    );
    await openList();
    const element = option("10:00");
    const text = element.textContent ?? "";
    expect(text).toBe(t("10:00"));
    expect(charLeft(element, text.indexOf("1"))).toBeLessThan(charLeft(element, text.indexOf("A")));
  });

  it("an ar-EG option reads with the period at the inline end (left), in an LTR or RTL page", async () => {
    for (const dir of ["ltr", "rtl"] as const) {
      const screen = await render(
        <div dir={dir} className="p-16">
          <TimePicker aria-label="Start" locale="ar-EG" min="09:00" max="11:00" />
        </div>,
      );
      await openList();
      const element = option("10:00");
      const text = element.textContent ?? "";
      expect(text).toBe(formatTime("10:00", "ar-EG"));
      const period = text.indexOf("ص");
      expect(period, text).toBeGreaterThan(-1);
      expect(charLeft(element, period), dir).toBeLessThan(charLeft(element, 0));
      await screen.unmount();
    }
  });
});

describe("TimePicker: placement", () => {
  it("a list taller than the room above and below stays below the field and scrolls; it never moves to the side", async () => {
    await page.viewport(800, 400);
    try {
      await render(
        <div className="flex h-[400px] items-center">
          <div className="w-72">
            <TimePicker aria-label="Start time" locale="en-US" />
          </div>
        </div>,
      );
      const element = await openList();
      const s = shell().getBoundingClientRect();
      const p = element.getBoundingClientRect();
      expect(["top", "bottom"]).toContain(element.getAttribute("data-side"));
      expect(p.left).toBeLessThan(s.right);
      expect(p.top).toBeGreaterThanOrEqual(0);
      expect(p.bottom).toBeLessThanOrEqual(400);
      expect(list().scrollHeight).toBeGreaterThan(list().clientHeight);
    } finally {
      await page.viewport(1280, 720);
    }
  });
});

describe("TimePicker: focus, forced colors and motion", () => {
  it("Tab focus: the group ring, the icon button ring and the focused option outline are solid", async () => {
    await render(
      <div>
        <Input aria-label="Before" />
        <Picker min="09:00" max="11:00" />
      </div>,
    );
    await userEvent.click(page.getByRole("textbox", { name: "Before" }));
    await userEvent.tab();
    expect(document.activeElement).toBe(seg("hour"));
    expect(getComputedStyle(group()).outlineStyle).toBe("solid");
    expect(getComputedStyle(group()).outlineWidth).toBe("1px");
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(iconButton());
    expect(getComputedStyle(iconButton()).outlineStyle).toBe("solid");
    await userEvent.keyboard("{Enter}");
    await expect.element(dialog()).toBeVisible();
    await expect.poll(focusedValue).toBe("09:00");
    expect(getComputedStyle(option("09:00")).outlineStyle).toBe("solid");
    expect(getComputedStyle(option("09:30")).outlineStyle).toBe("none");
  });

  it("forced colors: Highlight rings on the group and button; the focused option's outline is painted; the selected option shows the check", async () => {
    await emulateForcedColors(true);
    await render(<Picker min="09:00" max="11:00" defaultValue="10:00" />);
    expect(getComputedStyle(iconButton()).outlineStyle).toBe("none");
    await userEvent.click(seg("hour"));
    expect(getComputedStyle(group()).outlineColor).toBe(systemColor("Highlight"));
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(iconButton());
    expect(getComputedStyle(iconButton()).outlineStyle).toBe("solid");
    expect(getComputedStyle(iconButton()).outlineColor).toBe(systemColor("Highlight"));
    await userEvent.keyboard("{Enter}");
    await expect.element(dialog()).toBeVisible();
    await expect.poll(focusedValue).toBe("10:00");
    await userEvent.keyboard("{ArrowDown}");
    const focused = getComputedStyle(option("10:30"));
    expect(focused.outlineStyle).toBe("solid");
    expect(focused.outlineColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(option("10:00")).outlineStyle).toBe("none");
    expect(option("10:00").querySelector("svg")).not.toBeNull();
    expect(option("10:30").querySelector("svg")).toBeNull();
  });

  it("reduced motion: the popup and the group have no transition", async () => {
    await render(<Picker min="09:00" max="11:00" />);
    const element = await openList();
    expect(getComputedStyle(element).transitionProperty).not.toBe("none");
    await emulateReducedMotion(true);
    expect(getComputedStyle(element).transitionProperty).toBe("none");
    expect(getComputedStyle(group()).transitionProperty).toBe("none");
  });
});

describe("TimePicker: accessibility", () => {
  it.each(["light", "dark"] as const)(
    "has no axe violations or incomplete results closed and open (%s)",
    async (theme) => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(
        <div className="bg-background p-16">
          <Field>
            <FieldLabel>Start time</FieldLabel>
            <TimePicker locale="en-US" min="09:00" max="11:00" defaultValue="10:00" />
          </Field>
        </div>,
      );
      const closed = await auditOpenOverlay();
      expect(closed.violations).toEqual([]);
      expect(closed.incomplete).toEqual([]);
      await openList();
      await expect.poll(focusedValue).toBe("10:00");
      const opened = await auditOpenOverlay();
      expect(opened.violations).toEqual([]);
      expect(opened.incomplete).toEqual([]);
    },
  );

  it("has no axe violations or incomplete results open under dir=rtl and with an empty list", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // A list short enough not to scroll: axe leaves the contrast of text clipped by a scrolled
    // container undecided ("incomplete"), whatever its colours.
    const screen = await render(
      <div dir="rtl" className="bg-background p-16">
        <TimePicker
          aria-label="Start time"
          locale="en-US"
          min="09:00"
          max="11:00"
          defaultValue="10:00"
        />
      </div>,
    );
    await openList();
    const rtl = await auditOpenOverlay();
    expect(rtl.violations).toEqual([]);
    expect(rtl.incomplete).toEqual([]);
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await screen.rerender(
      <div className="bg-background p-16">
        <TimePicker aria-label="Start time" locale="en-US" slotStep={0} />
      </div>,
    );
    await openList();
    const empty = await auditOpenOverlay();
    expect(empty.violations).toEqual([]);
    expect(empty.incomplete).toEqual([]);
  });
});
