import { useFormContext } from "@base-ui/react/internals/form-context";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, resetEmulatedMedia, systemColor } from "../../../test/emulation";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { removeEyeDropper } from "../../../test/platform";
import { Button } from "../button";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import { ColorArea, ColorHueSlider, ColorInput, ColorPicker } from "./color-picker";
import { ColorPickerPopover, type ColorPickerPopoverProps } from "./color-picker-popover";

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.classList.remove("dark");
  await resetEmulatedMedia();
});

const triggerEl = () =>
  document.querySelector<HTMLButtonElement>(
    "[data-slot=color-picker-trigger]",
  ) as HTMLButtonElement;
const popup = () => document.querySelector<HTMLElement>("[data-slot=color-picker-popover]");
const dialog = () => page.getByRole("dialog");
const areaThumb = () => page.getByRole("slider", { name: "Saturation and brightness" });
const textInput = () => page.getByRole("textbox", { name: "Color value" });
const slot = (name: string) => document.querySelector<HTMLElement>(`[data-slot=${name}]`);
const slots = (name: string) => document.querySelectorAll<HTMLElement>(`[data-slot=${name}]`);
const frames = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

async function open(trigger: HTMLElement = triggerEl()) {
  await userEvent.click(trigger);
  await expect.element(dialog()).toBeVisible();
  const element = popup() as HTMLElement;
  await waitForPopupSettled(element);
  return element;
}

function Picker(props: ColorPickerPopoverProps) {
  // Padding leaves room on every side, so the popup never flips.
  return (
    <div className="p-16">
      <ColorPickerPopover defaultValue="#1d4ed8" {...props} />
    </div>
  );
}

/** Reads the enclosing Form's registered field controls (Base UI's form context). */
function RegisteredControls({ onRead }: { onRead: (count: number) => void }) {
  const { formRef } = useFormContext();
  return (
    <button type="button" onClick={() => onRead(formRef.current.fields.size)}>
      Count controls
    </button>
  );
}

describe("ColorPickerPopover trigger", () => {
  it("is named exactly 'Choose color: #1d4ed8' and shows the hex beside a swatch", async () => {
    await render(<Picker />);
    const trigger = page.getByRole("button", { name: "Choose color: #1d4ed8", exact: true });
    await expect.element(trigger).toBeVisible();
    await expect.element(trigger).toHaveAccessibleName("Choose color: #1d4ed8");
    expect(trigger.element()).toBe(triggerEl());
    // The colon lives in the label function's string: an aria-label, no sr-only text.
    expect(triggerEl().getAttribute("aria-label")).toBe("Choose color: #1d4ed8");
    expect(triggerEl().querySelector(".sr-only")).toBeNull();
    expect(triggerEl().textContent).toBe("#1d4ed8");
    const swatch = slot("color-picker-trigger-swatch") as HTMLElement;
    expect(swatch.getAttribute("aria-hidden")).toBe("true");
    expect(getComputedStyle(swatch).backgroundColor).toBe("rgb(29, 78, 216)");
    expect(triggerEl().getAttribute("aria-haspopup")).toBe("dialog");
    expect(popup()).toBeNull();
  });

  it("triggerLabel localises the name", async () => {
    await render(<Picker triggerLabel={(hex) => `Farbe wählen: ${hex}`} />);
    await expect
      .element(page.getByRole("button", { name: "Farbe wählen: #1d4ed8", exact: true }))
      .toBeVisible();
  });

  it("in a Field: named by the label then its own name; the description describes it", async () => {
    await render(
      <Field>
        <FieldLabel>Primary color</FieldLabel>
        <ColorPickerPopover defaultValue="#1d4ed8" />
        <FieldDescription>Buttons and links.</FieldDescription>
      </Field>,
    );
    const trigger = page.getByRole("button", { name: "Primary color Choose color: #1d4ed8" });
    await expect.element(trigger).toBeVisible();
    await expect.element(trigger).toHaveAccessibleDescription("Buttons and links.");
    const label = slot("field-label") as HTMLLabelElement;
    expect(triggerEl().getAttribute("aria-labelledby")).toBe(`${label.id} ${triggerEl().id}`);
  });

  it("the trigger swatch has the swatches' rim and a checkerboard behind an alpha colour", async () => {
    await render(
      <>
        <ColorPickerPopover alpha defaultValue="#1d4ed880" />
        <ColorPicker swatches={["#ff0000"]} aria-label="Reference" />
      </>,
    );
    const swatch = slot("color-picker-trigger-swatch") as HTMLElement;
    const reference = slot("color-swatch") as HTMLElement;
    expect(getComputedStyle(swatch).borderTopColor).toBe(
      getComputedStyle(reference).borderTopColor,
    );
    expect(getComputedStyle(swatch).backgroundImage).toContain("conic-gradient");
    const fill = swatch.firstElementChild as HTMLElement;
    expect(getComputedStyle(fill).backgroundColor).toBe("rgba(29, 78, 216, 0.5)");
    expect(triggerEl().textContent).toBe("#1d4ed880");
  });

  it("disabled: not-allowed cursor and never opens", async () => {
    await render(<Picker disabled />);
    expect(triggerEl().disabled).toBe(true);
    expect(getComputedStyle(triggerEl()).cursor).toBe("not-allowed");
    await userEvent.click(triggerEl(), { force: true });
    await frames();
    expect(popup()).toBeNull();
  });
});

describe("ColorPickerPopover popup", () => {
  it("opens a dialog with a hidden title, focusing the area thumb; Escape closes and returns focus", async () => {
    removeEyeDropper();
    await render(<Picker name="accent" />);
    const element = await open();
    await expect.element(dialog()).toHaveAccessibleName("Color picker");
    const title = slot("popover-title") as HTMLElement;
    expect(title.textContent).toBe("Color picker");
    expect(title.className).toContain("sr-only");
    expect(element.querySelector("[data-slot=color-picker]")).not.toBeNull();
    await expect.poll(() => document.activeElement).toBe(areaThumb().element());
    await userEvent.keyboard("{Escape}");
    await expect.poll(popup).toBeNull();
    await expect.poll(() => document.activeElement).toBe(triggerEl());
    // The hidden input stays mounted while closed.
    expect(slots("color-picker-form-control")).toHaveLength(1);
    expect(slot("color-picker-form-control")?.getAttribute("name")).toBe("accent");
  });

  it("title names the popup", async () => {
    await render(<Picker title="Farbwähler" />);
    await open();
    await expect.element(dialog()).toHaveAccessibleName("Farbwähler");
  });

  it("the Escape layering: the first Escape after an edit reverts the text, the second closes", async () => {
    const onValueChange = vi.fn();
    await render(<Picker onValueChange={onValueChange} />);
    await open();
    await userEvent.fill(textInput(), "#00ff00");
    await userEvent.keyboard("{Escape}");
    await expect.element(textInput()).toHaveValue("#1d4ed8");
    await frames();
    // Still open, not closing: a close would flip aria-expanded and start the exit transition.
    expect(triggerEl().getAttribute("aria-expanded")).toBe("true");
    expect(popup()?.hasAttribute("data-ending-style")).toBe(false);
    expect(popup()?.hasAttribute("data-open")).toBe(true);
    expect(document.activeElement).toBe(textInput().element());
    await userEvent.keyboard("{Escape}");
    await expect.poll(popup).toBeNull();
    await expect.poll(() => document.activeElement).toBe(triggerEl());
    expect(onValueChange).not.toHaveBeenCalled();
    expect(triggerEl().textContent).toBe("#1d4ed8");
  });

  it("changes in the picker update the trigger and report the hex", async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();
    await render(
      <Picker
        defaultValue="#ff0000"
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      />,
    );
    await open();
    await expect.poll(() => document.activeElement).toBe(areaThumb().element());
    await userEvent.keyboard("{Home}");
    expect(onValueChange).toHaveBeenLastCalledWith("#ffffff");
    expect(onValueCommitted).toHaveBeenLastCalledWith("#ffffff");
    await expect.element(page.getByRole("button", { name: "Choose color: #ffffff" })).toBeVisible();
    await userEvent.fill(textInput(), "rgb(29 78 216)");
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith("#1d4ed8");
    expect(triggerEl().textContent).toBe("#1d4ed8");
  });

  it("children replace the popup's composition", async () => {
    await render(
      <Picker>
        <ColorArea />
        <ColorHueSlider />
        <ColorInput format="rgb" />
      </Picker>,
    );
    await open();
    expect(slot("color-format-toggle")).toBeNull();
    await expect.element(textInput()).toHaveValue("rgb(29 78 216)");
  });

  it("the thumbs' overhang is not clipped: the popup is padded and does not hide overflow", async () => {
    // White: saturation 0 / brightness 100, so the thumb sits on the area's top-left corner.
    await render(<Picker defaultValue="#ffffff" />);
    const element = await open();
    expect(getComputedStyle(element).overflow).toBe("visible");
    const box = element.getBoundingClientRect();
    const thumb = areaThumb().element().getBoundingClientRect();
    expect(thumb.left).toBeGreaterThanOrEqual(box.left + 1);
    expect(thumb.top).toBeGreaterThanOrEqual(box.top + 1);
  });

  it("stays within a 390px viewport", async () => {
    await page.viewport(390, 800);
    try {
      await render(
        <div className="flex justify-end p-4">
          <ColorPickerPopover defaultValue="#1d4ed8" alpha swatches={["#ff0000", "#00ff00"]} />
        </div>,
      );
      const element = await open();
      const box = element.getBoundingClientRect();
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(390);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
    } finally {
      await page.viewport(1280, 720);
    }
  });
});

describe("ColorPickerPopover controlled and uncontrolled", () => {
  it("defaultValue seeds an uncontrolled picker that follows its own changes across reopening", async () => {
    await render(<Picker defaultValue="#FF0000" />);
    expect(triggerEl().textContent).toBe("#ff0000");
    await open();
    await expect.poll(() => document.activeElement).toBe(areaThumb().element());
    await userEvent.keyboard("{End}");
    await userEvent.keyboard("{PageDown}");
    await userEvent.keyboard("{Escape}");
    await expect.poll(popup).toBeNull();
    expect(triggerEl().textContent).toBe("#e60000");
    await open();
    await expect.element(textInput()).toHaveValue("#e60000");
  });

  it("value + onValueChange: the parent's state drives the trigger", async () => {
    function Controlled() {
      const [value, setValue] = useState("#ff0000");
      return (
        <>
          <Picker value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue("#00ff00")}>
            Green
          </button>
        </>
      );
    }
    await render(<Controlled />);
    await userEvent.click(page.getByRole("button", { name: "Green" }));
    await expect.element(page.getByRole("button", { name: "Choose color: #00ff00" })).toBeVisible();
    await open();
    await userEvent.keyboard("{PageDown}");
    expect(triggerEl().textContent).toBe("#00e600");
  });

  it("a controlled parent that ignores changes keeps the trigger and the picker at value", async () => {
    const onValueChange = vi.fn();
    await render(<Picker value="#ff0000" onValueChange={onValueChange} />);
    await open();
    await expect.poll(() => document.activeElement).toBe(areaThumb().element());
    await userEvent.keyboard("{PageDown}");
    expect(onValueChange).toHaveBeenCalledWith("#e60000");
    expect(triggerEl().textContent).toBe("#ff0000");
    await expect.element(textInput()).toHaveValue("#ff0000");
  });

  it("an unparsable value is ignored with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await render(<Picker value="tomato" />);
    expect(triggerEl().textContent).toBe("#000000");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("tomato"));
  });

  it("alpha off drops an incoming alpha; alpha on keeps it", async () => {
    const screen = await render(<Picker defaultValue="#ff000080" />);
    expect(triggerEl().textContent).toBe("#ff0000");
    await screen.unmount();
    await render(<Picker alpha defaultValue="#ff000080" />);
    expect(triggerEl().textContent).toBe("#ff000080");
  });

  it("format: defaultFormat survives reopening; controlled format reports changes", async () => {
    const onFormatChange = vi.fn();
    await render(<Picker defaultFormat="rgb" onFormatChange={onFormatChange} />);
    await open();
    await expect.element(textInput()).toHaveValue("rgb(29 78 216)");
    await userEvent.click(page.getByRole("button", { name: "HSL" }));
    expect(onFormatChange).toHaveBeenCalledWith("hsl");
    await userEvent.keyboard("{Escape}");
    await expect.poll(popup).toBeNull();
    await open();
    await expect.element(textInput()).toHaveValue("hsl(224 76% 48%)");
  });
});

describe("ColorPickerPopover in a form", () => {
  it("in a Field in a Form: one control, one FormData entry, onFormSubmit under the Field name", async () => {
    const onFormSubmit = vi.fn();
    let native: FormData | null = null;
    const counts: number[] = [];
    await render(
      <Form
        aria-label="Theme"
        onFormSubmit={onFormSubmit}
        onSubmit={(event) => {
          native = new FormData(event.currentTarget);
        }}
      >
        <Field name="primary">
          <FieldLabel>Primary color</FieldLabel>
          <ColorPickerPopover defaultValue="#1d4ed8" swatches={["#ff0000"]} />
        </Field>
        <RegisteredControls onRead={(count) => counts.push(count)} />
        <Button type="submit">Save</Button>
      </Form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Count controls" }));
    expect(slots("color-picker-form-control")).toHaveLength(1);
    // Open: the inner picker adds no control, no input and no Field labelling.
    await open();
    expect(slots("color-picker-form-control")).toHaveLength(1);
    const group = page.getByRole("group", { name: "Color picker" });
    await expect.element(group).toBeInTheDocument();
    expect(group.element().hasAttribute("aria-labelledby")).toBe(false);
    await userEvent.keyboard("{Escape}");
    await expect.poll(popup).toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Count controls" }));
    expect(counts).toEqual([1, 1]);
    // The Field label names the trigger, not the inner group.
    await expect
      .element(page.getByRole("button", { name: "Primary color Choose color: #1d4ed8" }))
      .toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1));
    expect(onFormSubmit.mock.calls[0]?.[0]).toEqual({ primary: "#1d4ed8" });
    expect((native as unknown as FormData).getAll("primary")).toEqual(["#1d4ed8"]);
    expect([...(native as unknown as FormData).keys()]).toEqual(["primary"]);
  });

  it("name and form submit the hex through native FormData; disabled submits nothing", async () => {
    let data: FormData | null = null;
    const screen = await render(
      <>
        <form
          id="theme-form"
          aria-label="Theme"
          onSubmit={(event) => {
            event.preventDefault();
            data = new FormData(event.currentTarget);
          }}
        >
          <button type="submit">Save</button>
        </form>
        <ColorPickerPopover name="accent" form="theme-form" defaultValue="#1d4ed8" />
      </>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(data).not.toBeNull());
    expect((data as unknown as FormData).getAll("accent")).toEqual(["#1d4ed8"]);
    await screen.unmount();
    data = null;
    await render(
      <form
        aria-label="Theme"
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <ColorPickerPopover name="accent" defaultValue="#1d4ed8" disabled />
        <button type="submit">Save</button>
      </form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(data).not.toBeNull());
    expect((data as unknown as FormData).has("accent")).toBe(false);
  });

  it("a Field validate that rejects focuses the trigger on submit", async () => {
    const onFormSubmit = vi.fn();
    await render(
      <Form aria-label="Theme" onFormSubmit={onFormSubmit}>
        <Field name="primary" validate={() => "Pick a darker colour"}>
          <FieldLabel>Primary color</FieldLabel>
          <ColorPickerPopover defaultValue="#ffff66" />
          <FieldError />
        </Field>
        <Button type="submit">Save</Button>
      </Form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.element(page.getByText("Pick a darker colour")).toBeVisible();
    expect(onFormSubmit).not.toHaveBeenCalled();
    await expect.poll(() => document.activeElement).toBe(triggerEl());
  });

  it("the Field's blur fires only when focus leaves the trigger + popup", async () => {
    removeEyeDropper();
    await render(
      <Form aria-label="Theme">
        <Field name="primary">
          <FieldLabel>Primary color</FieldLabel>
          <ColorPickerPopover defaultValue="#1d4ed8" />
        </Field>
        <Button type="button">After</Button>
      </Form>,
    );
    const field = slot("field") as HTMLElement;
    await userEvent.tab();
    expect(document.activeElement).toBe(triggerEl());
    await userEvent.keyboard("{Enter}");
    await expect.element(dialog()).toBeVisible();
    await expect.poll(() => document.activeElement).toBe(areaThumb().element());
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(textInput().element());
    await userEvent.keyboard("{Escape}");
    await expect.poll(popup).toBeNull();
    await expect.poll(() => document.activeElement).toBe(triggerEl());
    await frames();
    expect(field.hasAttribute("data-touched")).toBe(false);
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("button", { name: "After" }).element());
    await expect.poll(() => field.hasAttribute("data-touched")).toBe(true);
  });

  it("a disabled Field disables the trigger", async () => {
    await render(
      <Field disabled>
        <FieldLabel>Primary color</FieldLabel>
        <ColorPickerPopover />
      </Field>,
    );
    expect(triggerEl().disabled).toBe(true);
  });
});

describe("ColorPickerPopover styles", () => {
  it("forced colors: the trigger swatch keeps its colour with a CanvasText border", async () => {
    await emulateForcedColors(true);
    await render(<Picker />);
    const swatch = getComputedStyle(slot("color-picker-trigger-swatch") as HTMLElement);
    expect(swatch.forcedColorAdjust).toBe("none");
    expect(swatch.backgroundColor).toBe("rgb(29, 78, 216)");
    expect(swatch.borderTopStyle).toBe("solid");
    expect(swatch.borderTopColor).toBe(systemColor("CanvasText"));
  });
});

describe("ColorPickerPopover axe", () => {
  it.each(["light", "dark"] as const)(
    "has no axe violations closed and open (%s)",
    async (theme) => {
      removeEyeDropper();
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(
        // The popup opens to the right of a narrow Field, so it covers none of the page's text.
        <div className="flex w-72 flex-col gap-4 bg-background p-16">
          <ColorPickerPopover disabled defaultValue="#16a34a" />
          <Field>
            <FieldLabel>Primary color</FieldLabel>
            <ColorPickerPopover name="primary" alpha defaultValue="#1d4ed8cc" side="right" />
            <FieldDescription>Buttons and links.</FieldDescription>
          </Field>
        </div>,
      );
      const closed = await auditOpenOverlay();
      expect(closed.violations).toEqual([]);
      expect(closed.incomplete).toEqual([]);
      await open(page.getByRole("button", { name: /^Primary color/ }).element() as HTMLElement);
      const opened = await auditOpenOverlay();
      expect(opened.violations).toEqual([]);
      expect(opened.incomplete).toEqual([]);
    },
  );
});
