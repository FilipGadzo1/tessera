import { useFormContext } from "@base-ui/react/internals/form-context";
import axe from "axe-core";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, emulateReducedMotion, systemColor } from "../../../test/emulation";
import { removeEyeDropper, stubEyeDropper } from "../../../test/platform";
import { formatHex, hsvToRgb } from "../../lib/color";
import { yieldEscapeToTooltip } from "../../lib/tooltip-escape";
import { Button } from "../button";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import {
  ColorAlphaSlider,
  ColorArea,
  ColorEyeDropper,
  ColorFormatToggle,
  ColorHueSlider,
  ColorInput,
  ColorPicker,
  ColorPickerHostContext,
  ColorSwatch,
  ColorSwatches,
} from "./color-picker";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The hex the picker reports for an HSVA state (the colour helpers are tested on their own). */
const hexOf = (h: number, s: number, v: number, a = 1) => formatHex(hsvToRgb({ h, s, v, a }));

const areaThumb = () => page.getByRole("slider", { name: "Saturation and brightness" });
const hueThumb = () => page.getByRole("slider", { name: "Hue" });
const alphaThumb = () => page.getByRole("slider", { name: "Alpha" });
const textInput = () => page.getByRole("textbox", { name: "Color value" });
const slot = (name: string) => document.querySelector<HTMLElement>(`[data-slot=${name}]`);
const slots = (name: string) => document.querySelectorAll<HTMLElement>(`[data-slot=${name}]`);
const valueNow = (thumb: ReturnType<typeof areaThumb>) =>
  Number(thumb.element().getAttribute("aria-valuenow"));
const centreX = (element: Element) => {
  const rect = element.getBoundingClientRect();
  return rect.left + rect.width / 2;
};

/** A Playwright mouse drag (real pointer events, so pointer capture is real) within `element`. */
async function drag(
  element: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await userEvent.dragAndDrop(page.elementLocator(element), page.elementLocator(element), {
    force: true,
    sourcePosition: from,
    targetPosition: to,
    steps: 10,
  } as Parameters<typeof userEvent.dragAndDrop>[2]);
}

describe("ColorPicker rendering", () => {
  it("renders the default composition with its data-slots", async () => {
    removeEyeDropper();
    await render(<ColorPicker />);
    const root = page.getByRole("group", { name: "Color picker" });
    await expect.element(root).toHaveAttribute("data-slot", "color-picker");
    expect(slot("color-area")).not.toBeNull();
    expect(slot("color-area-thumb")).toBe(areaThumb().element());
    expect(slot("color-hue-slider")).not.toBeNull();
    expect(slots("color-slider-thumb")).toHaveLength(1);
    expect(slot("color-input")).toBe(textInput().element());
    expect(slot("color-format-toggle")).not.toBeNull();
    expect(slot("color-alpha-slider")).toBeNull();
    expect(slot("color-swatches")).toBeNull();
    expect(slot("color-eye-dropper")).toBeNull();
    // The default value.
    await expect.element(textInput()).toHaveValue("#000000");
  });

  it("alpha adds the alpha slider; swatches adds the swatches", async () => {
    await render(<ColorPicker alpha swatches={["#ff0000", "#00ff00"]} />);
    expect(slot("color-alpha-slider")).not.toBeNull();
    await expect.element(alphaThumb()).toBeInTheDocument();
    expect(slots("color-slider-thumb")).toHaveLength(2);
    expect(slot("color-swatches")).not.toBeNull();
    expect(slots("color-swatch")).toHaveLength(2);
  });

  it("children replace the default composition", async () => {
    await render(
      <ColorPicker defaultValue="#ff0000">
        <ColorHueSlider />
        <ColorInput />
      </ColorPicker>,
    );
    await expect.element(hueThumb()).toBeInTheDocument();
    expect(slot("color-area")).toBeNull();
    expect(slot("color-format-toggle")).toBeNull();
    await expect.element(textInput()).toHaveValue("#ff0000");
  });

  it("ColorSwatches renders ColorSwatch children instead of the root's swatches", async () => {
    await render(
      <ColorPicker>
        <ColorSwatches>
          <ColorSwatch value="#1d4ed8" label="Brand" />
        </ColorSwatches>
      </ColorPicker>,
    );
    await expect.element(page.getByRole("button", { name: "Brand" })).toBeInTheDocument();
    expect(slots("color-swatch")).toHaveLength(1);
  });
});

describe("ColorPicker ARIA", () => {
  it("the area thumb is a 2D slider with saturation as its value", async () => {
    await render(<ColorPicker defaultValue="#ff0000" />);
    const thumb = areaThumb();
    await expect.element(thumb).toHaveAttribute("aria-roledescription", "2D slider");
    await expect.element(thumb).toHaveAttribute("aria-valuemin", "0");
    await expect.element(thumb).toHaveAttribute("aria-valuemax", "100");
    await expect.element(thumb).toHaveAttribute("aria-valuenow", "100");
    await expect
      .element(thumb)
      .toHaveAttribute("aria-valuetext", "Saturation 100%, Brightness 100%");
    await expect.element(thumb).toHaveAttribute("tabindex", "0");
    expect(slot("color-area")?.getAttribute("dir")).toBe("ltr");
  });

  it("the hue and alpha channels are horizontal sliders", async () => {
    await render(<ColorPicker alpha defaultValue="#0080ff80" />);
    const hue = hueThumb();
    await expect.element(hue).toHaveAttribute("aria-orientation", "horizontal");
    await expect.element(hue).toHaveAttribute("aria-valuemin", "0");
    await expect.element(hue).toHaveAttribute("aria-valuemax", "360");
    await expect.element(hue).toHaveAttribute("aria-valuenow", "210");
    await expect.element(hue).toHaveAttribute("aria-valuetext", "210°");
    const alpha = alphaThumb();
    await expect.element(alpha).toHaveAttribute("aria-orientation", "horizontal");
    await expect.element(alpha).toHaveAttribute("aria-valuemin", "0");
    await expect.element(alpha).toHaveAttribute("aria-valuemax", "100");
    await expect.element(alpha).toHaveAttribute("aria-valuenow", "50");
    await expect.element(alpha).toHaveAttribute("aria-valuetext", "50%");
    expect(slot("color-hue-slider")?.getAttribute("dir")).toBe("ltr");
    expect(slot("color-alpha-slider")?.getAttribute("dir")).toBe("ltr");
  });

  it("takes custom getValueText and aria-labels", async () => {
    await render(
      <ColorPicker alpha defaultValue="#0080ff80" aria-label="Akzentfarbe">
        <ColorArea
          aria-label="Farbfläche"
          getValueText={(s, v) => `Sättigung ${s} Prozent, Helligkeit ${v} Prozent`}
        />
        <ColorHueSlider aria-label="Farbton" getValueText={(h) => `${h} Grad`} />
        <ColorAlphaSlider aria-label="Deckkraft" getValueText={(a) => `${a} Prozent`} />
        <ColorInput aria-label="Farbwert" />
        <ColorFormatToggle aria-label="Format" formatLabel={(format) => format} />
      </ColorPicker>,
    );
    await expect.element(page.getByRole("group", { name: "Akzentfarbe" })).toBeInTheDocument();
    await expect
      .element(page.getByRole("slider", { name: "Farbfläche" }))
      .toHaveAttribute("aria-valuetext", "Sättigung 100 Prozent, Helligkeit 100 Prozent");
    await expect
      .element(page.getByRole("slider", { name: "Farbton" }))
      .toHaveAttribute("aria-valuetext", "210 Grad");
    await expect
      .element(page.getByRole("slider", { name: "Deckkraft" }))
      .toHaveAttribute("aria-valuetext", "50 Prozent");
    await expect.element(page.getByRole("textbox", { name: "Farbwert" })).toBeInTheDocument();
    await expect.element(page.getByRole("group", { name: "Format" })).toBeInTheDocument();
  });
});

describe("ColorPicker area keys", () => {
  // From #804040 (hue 0, saturation 50, brightness 50.2 → snapped to 50 by the first key).
  const cases: [string, string, number, number][] = [
    ["{ArrowRight}", "→", 51, 50],
    ["{ArrowLeft}", "←", 49, 50],
    ["{ArrowUp}", "↑", 50, 51],
    ["{ArrowDown}", "↓", 50, 49],
    ["{Shift>}{ArrowRight}{/Shift}", "Shift+→", 60, 50],
    ["{Shift>}{ArrowLeft}{/Shift}", "Shift+←", 40, 50],
    ["{Shift>}{ArrowUp}{/Shift}", "Shift+↑", 50, 60],
    ["{Shift>}{ArrowDown}{/Shift}", "Shift+↓", 50, 40],
    ["{PageUp}", "PageUp", 50, 60],
    ["{PageDown}", "PageDown", 50, 40],
    ["{Home}", "Home", 0, 50],
    ["{End}", "End", 100, 50],
  ];
  it.each(cases)("%s (%s) moves to saturation %i, brightness %i", async (key, _name, s, v) => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();
    await render(
      <ColorPicker
        defaultValue="#804040"
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      />,
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(areaThumb().element());
    await userEvent.keyboard(key);
    await expect.element(areaThumb()).toHaveAttribute("aria-valuenow", String(s));
    await expect
      .element(areaThumb())
      .toHaveAttribute("aria-valuetext", `Saturation ${s}%, Brightness ${v}%`);
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
    expect(onValueCommitted).toHaveBeenLastCalledWith(hexOf(0, s, v));
    expect(onValueChange).toHaveBeenLastCalledWith(hexOf(0, s, v));
  });

  const clamps: [string, string, number, number][] = [
    ["#ff0000", "{ArrowRight}", 100, 100],
    ["#ff0000", "{ArrowUp}", 100, 100],
    ["#ff0000", "{Shift>}{ArrowUp}{/Shift}", 100, 100],
    ["#ff0000", "{PageUp}", 100, 100],
    ["#ff0000", "{End}", 100, 100],
    ["#fa0505", "{Shift>}{ArrowRight}{/Shift}", 100, 98],
    ["#000000", "{ArrowLeft}", 0, 0],
    ["#000000", "{ArrowDown}", 0, 0],
    ["#000000", "{Shift>}{ArrowDown}{/Shift}", 0, 0],
    ["#000000", "{PageDown}", 0, 0],
    ["#000000", "{Home}", 0, 0],
  ];
  it.each(clamps)(
    "from %s, %s clamps at saturation %i, brightness %i",
    async (start, key, s, v) => {
      const onValueCommitted = vi.fn();
      await render(<ColorPicker defaultValue={start} onValueCommitted={onValueCommitted} />);
      await userEvent.tab();
      await userEvent.keyboard(key);
      await expect
        .element(areaThumb())
        .toHaveAttribute("aria-valuetext", `Saturation ${s}%, Brightness ${v}%`);
      // Each key press commits, even one that changes nothing.
      expect(onValueCommitted).toHaveBeenCalledTimes(1);
      expect(onValueCommitted).toHaveBeenLastCalledWith(hexOf(0, s, v));
    },
  );
});

describe("ColorPicker channel keys", () => {
  // From #0080ff: hue 209.9 (snapped to 210 by the first key), saturation and brightness 100.
  const hue: [string, string, number][] = [
    ["{ArrowRight}", "→", 211],
    ["{ArrowUp}", "↑", 211],
    ["{ArrowLeft}", "←", 209],
    ["{ArrowDown}", "↓", 209],
    ["{Shift>}{ArrowRight}{/Shift}", "Shift+→", 220],
    ["{Shift>}{ArrowLeft}{/Shift}", "Shift+←", 200],
    ["{Shift>}{ArrowUp}{/Shift}", "Shift+↑", 220],
    ["{Shift>}{ArrowDown}{/Shift}", "Shift+↓", 200],
    ["{PageUp}", "PageUp", 225],
    ["{PageDown}", "PageDown", 195],
    ["{Home}", "Home", 0],
    ["{End}", "End", 360],
  ];
  it.each(hue)("hue: %s (%s) moves to %i", async (key, _name, h) => {
    const onValueCommitted = vi.fn();
    await render(<ColorPicker defaultValue="#0080ff" onValueCommitted={onValueCommitted} />);
    hueThumb().element().focus();
    await userEvent.keyboard(key);
    await expect.element(hueThumb()).toHaveAttribute("aria-valuenow", String(h));
    await expect.element(hueThumb()).toHaveAttribute("aria-valuetext", `${h}°`);
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
    expect(onValueCommitted).toHaveBeenLastCalledWith(hexOf(h, 100, 100));
  });

  it("hue 360 is allowed and reports the same colour as 0; the ends clamp", async () => {
    const onValueCommitted = vi.fn();
    await render(<ColorPicker defaultValue="#ff0000" onValueCommitted={onValueCommitted} />);
    hueThumb().element().focus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(hueThumb()).toHaveAttribute("aria-valuenow", "0");
    await userEvent.keyboard("{PageDown}");
    await expect.element(hueThumb()).toHaveAttribute("aria-valuenow", "0");
    await userEvent.keyboard("{End}");
    await expect.element(hueThumb()).toHaveAttribute("aria-valuenow", "360");
    expect(onValueCommitted).toHaveBeenLastCalledWith("#ff0000");
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(hueThumb()).toHaveAttribute("aria-valuenow", "360");
    expect(onValueCommitted).toHaveBeenCalledTimes(4);
  });

  // From #ff000080: alpha 128/255 = 50.2% (snapped to 50 by the first key).
  const alpha: [string, string, number][] = [
    ["{ArrowRight}", "→", 51],
    ["{ArrowUp}", "↑", 51],
    ["{ArrowLeft}", "←", 49],
    ["{ArrowDown}", "↓", 49],
    ["{Shift>}{ArrowRight}{/Shift}", "Shift+→", 60],
    ["{Shift>}{ArrowLeft}{/Shift}", "Shift+←", 40],
    ["{PageUp}", "PageUp", 60],
    ["{PageDown}", "PageDown", 40],
    ["{Home}", "Home", 0],
    ["{End}", "End", 100],
  ];
  it.each(alpha)("alpha: %s (%s) moves to %i", async (key, _name, a) => {
    const onValueCommitted = vi.fn();
    await render(
      <ColorPicker alpha defaultValue="#ff000080" onValueCommitted={onValueCommitted} />,
    );
    alphaThumb().element().focus();
    await userEvent.keyboard(key);
    await expect.element(alphaThumb()).toHaveAttribute("aria-valuenow", String(a));
    await expect.element(alphaThumb()).toHaveAttribute("aria-valuetext", `${a}%`);
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
    expect(onValueCommitted).toHaveBeenLastCalledWith(hexOf(0, 100, 100, a / 100));
  });

  it("alpha clamps at 100 and 0, and an opaque colour reports 6 digits", async () => {
    const onValueCommitted = vi.fn();
    await render(<ColorPicker alpha defaultValue="#ff0000" onValueCommitted={onValueCommitted} />);
    alphaThumb().element().focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(alphaThumb()).toHaveAttribute("aria-valuenow", "100");
    expect(onValueCommitted).toHaveBeenLastCalledWith("#ff0000");
    await userEvent.keyboard("{Home}");
    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(alphaThumb()).toHaveAttribute("aria-valuenow", "0");
    expect(onValueCommitted).toHaveBeenLastCalledWith("#ff000000");
  });
});

describe("ColorPicker RTL", () => {
  it("→ on the area still increases saturation and moves the thumb right", async () => {
    await render(
      <div dir="rtl">
        <ColorPicker defaultValue="#804040" />
      </div>,
    );
    const thumb = areaThumb().element();
    const before = centreX(thumb);
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(areaThumb()).toHaveAttribute("aria-valuenow", "51");
    expect(centreX(thumb)).toBeGreaterThan(before);
    // The colour surfaces are physical; the input follows the page.
    expect(slot("color-area")?.getAttribute("dir")).toBe("ltr");
    expect(getComputedStyle(textInput().element()).direction).toBe("rtl");
  });

  it("→ in the swatches moves to the previous swatch", async () => {
    await render(
      <div dir="rtl">
        <ColorPicker swatches={["#ff0000", "#00ff00", "#0000ff"]} />
      </div>,
    );
    const green = page.getByRole("button", { name: "#00ff00" });
    green.element().focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect
      .poll(() => document.activeElement)
      .toBe(page.getByRole("button", { name: "#ff0000" }).element());
    await userEvent.keyboard("{ArrowLeft}");
    await expect.poll(() => document.activeElement).toBe(green.element());
  });

  it("→ in the swatches moves to the next swatch in LTR", async () => {
    await render(<ColorPicker swatches={["#ff0000", "#00ff00", "#0000ff"]} />);
    page.getByRole("button", { name: "#00ff00" }).element().focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect
      .poll(() => document.activeElement)
      .toBe(page.getByRole("button", { name: "#0000ff" }).element());
  });
});

describe("ColorPicker pointer", () => {
  it("a press at the area's centre gives saturation 50, brightness 50 and focuses the thumb", async () => {
    const onValueCommitted = vi.fn();
    await render(<ColorPicker defaultValue="#ff0000" onValueCommitted={onValueCommitted} />);
    const area = slot("color-area") as HTMLElement;
    const rect = area.getBoundingClientRect();
    await userEvent.click(page.elementLocator(area), {
      position: { x: rect.width / 2, y: rect.height / 2 },
    });
    await expect.poll(() => valueNow(areaThumb())).toBeGreaterThanOrEqual(49);
    expect(valueNow(areaThumb())).toBeLessThanOrEqual(51);
    const brightness = Number(
      /Brightness (\d+)%/.exec(areaThumb().element().getAttribute("aria-valuetext") ?? "")?.[1],
    );
    expect(brightness).toBeGreaterThanOrEqual(49);
    expect(brightness).toBeLessThanOrEqual(51);
    expect(document.activeElement).toBe(areaThumb().element());
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
  });

  it("a drag past the top-right corner clamps to saturation 100, brightness 100", async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();
    await render(<ColorPicker onValueChange={onValueChange} onValueCommitted={onValueCommitted} />);
    const area = slot("color-area") as HTMLElement;
    const seen = { dragging: false };
    const observer = new MutationObserver(() => {
      seen.dragging ||= area.hasAttribute("data-dragging");
    });
    observer.observe(area, { attributes: true });
    const rect = area.getBoundingClientRect();
    await drag(area, { x: rect.width / 2, y: rect.height / 2 }, { x: rect.width + 40, y: -40 });
    await expect
      .element(areaThumb())
      .toHaveAttribute("aria-valuetext", "Saturation 100%, Brightness 100%");
    observer.disconnect();
    expect(seen.dragging).toBe(true);
    expect(area.hasAttribute("data-dragging")).toBe(false);
    // Every move reports; the drag commits once, at the end.
    expect(onValueChange.mock.calls.length).toBeGreaterThan(2);
    expect(onValueChange).toHaveBeenLastCalledWith("#ff0000");
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
    expect(onValueCommitted).toHaveBeenCalledWith("#ff0000");
  });

  it.each(["pointercancel", "lostpointercapture"] as const)(
    "%s mid-drag ends the drag: one commit, data-dragging cleared",
    async (ending) => {
      const onValueCommitted = vi.fn();
      await render(<ColorPicker defaultValue="#ff0000" onValueCommitted={onValueCommitted} />);
      const area = slot("color-area") as HTMLElement;
      let pointerId = -1;
      area.addEventListener("pointerdown", (event) => {
        pointerId = event.pointerId;
      });
      let ended = false;
      const seen = { dragging: false, clearedAfterEnd: false };
      // As soon as the drag starts, end it the way the browser would: a cancel (e.g. a touch turned
      // into a scroll) or the capture being taken away. The real mouse drag then carries on.
      const observer = new MutationObserver(() => {
        if (area.hasAttribute("data-dragging")) {
          seen.dragging = true;
          if (ended) return;
          ended = true;
          if (ending === "pointercancel") {
            area.dispatchEvent(new PointerEvent("pointercancel", { pointerId, bubbles: true }));
          } else {
            area.releasePointerCapture(pointerId);
          }
        } else if (ended) {
          seen.clearedAfterEnd = true;
        }
      });
      observer.observe(area, { attributes: true, attributeFilter: ["data-dragging"] });
      const rect = area.getBoundingClientRect();
      await drag(area, { x: rect.width / 2, y: rect.height / 2 }, { x: 4, y: rect.height - 4 });
      await expect.poll(() => seen.clearedAfterEnd).toBe(true);
      observer.disconnect();
      expect(seen.dragging).toBe(true);
      expect(area.hasAttribute("data-dragging")).toBe(false);
      // The cancel ended the drag; the pointerup that follows does not commit again.
      expect(onValueCommitted).toHaveBeenCalledTimes(1);
    },
  );

  it("a drag on the hue track moves the hue and commits once", async () => {
    const onValueCommitted = vi.fn();
    await render(<ColorPicker defaultValue="#ff0000" onValueCommitted={onValueCommitted} />);
    const track = slot("color-hue-slider") as HTMLElement;
    const rect = track.getBoundingClientRect();
    await drag(track, { x: 2, y: rect.height / 2 }, { x: rect.width / 2, y: rect.height / 2 });
    await expect.poll(() => valueNow(hueThumb())).toBeGreaterThanOrEqual(178);
    expect(valueNow(hueThumb())).toBeLessThanOrEqual(182);
    expect(document.activeElement).toBe(hueThumb().element());
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
  });

  it("the hue survives a grey: hue 210, saturation 0, then back up", async () => {
    await render(<ColorPicker defaultValue="#ff0000" />);
    const track = slot("color-hue-slider") as HTMLElement;
    const trackRect = track.getBoundingClientRect();
    await drag(
      track,
      { x: 2, y: trackRect.height / 2 },
      { x: (trackRect.width * 210) / 360, y: trackRect.height / 2 },
    );
    await expect.poll(() => valueNow(hueThumb())).toBeGreaterThan(200);
    const hue = valueNow(hueThumb());
    expect(Math.abs(hue - 210)).toBeLessThanOrEqual(2);
    const area = slot("color-area") as HTMLElement;
    const rect = area.getBoundingClientRect();
    // Saturation 0 (dragged past the top-left corner): white, whose hex has no hue.
    await drag(area, { x: rect.width - 2, y: 2 }, { x: -20, y: -20 });
    await expect.element(areaThumb()).toHaveAttribute("aria-valuenow", "0");
    await expect.element(textInput()).toHaveValue("#ffffff");
    expect(valueNow(hueThumb())).toBe(hue);
    // Back up: the colour has the same hue again.
    await drag(area, { x: 2, y: 2 }, { x: rect.width + 20, y: -20 });
    await expect.element(areaThumb()).toHaveAttribute("aria-valuenow", "100");
    expect(valueNow(hueThumb())).toBe(hue);
  });

  it("a typed grey keeps the hue", async () => {
    await render(<ColorPicker defaultValue="#0080ff" />);
    await userEvent.fill(textInput(), "#808080");
    await userEvent.keyboard("{Enter}");
    await expect.element(areaThumb()).toHaveAttribute("aria-valuenow", "0");
    await expect.element(hueThumb()).toHaveAttribute("aria-valuenow", "210");
  });
});

describe("ColorPicker input", () => {
  it("Enter commits a parsable text in any format and shows it in the display format", async () => {
    const onValueCommitted = vi.fn();
    await render(<ColorPicker onValueCommitted={onValueCommitted} />);
    await userEvent.fill(textInput(), "rgb(29 78 216)");
    // Typing alone does not change the value.
    expect(onValueCommitted).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    await expect.element(textInput()).toHaveValue("#1d4ed8");
    expect(onValueCommitted).toHaveBeenCalledWith("#1d4ed8");
  });

  it("blur commits a parsable text", async () => {
    const onValueCommitted = vi.fn();
    await render(<ColorPicker onValueCommitted={onValueCommitted} />);
    await userEvent.fill(textInput(), "hsl(0 100% 50%)");
    await userEvent.tab();
    await expect.element(textInput()).toHaveValue("#ff0000");
    expect(onValueCommitted).toHaveBeenCalledWith("#ff0000");
  });

  it("an unparsable text is aria-invalid while focused and reverts on blur", async () => {
    const onValueChange = vi.fn();
    await render(<ColorPicker defaultValue="#1d4ed8" onValueChange={onValueChange} />);
    await userEvent.fill(textInput(), "not a colour");
    await expect.element(textInput()).toHaveAttribute("aria-invalid", "true");
    await userEvent.keyboard("{Enter}");
    await expect.element(textInput()).toHaveValue("not a colour");
    await userEvent.tab();
    await expect.element(textInput()).toHaveValue("#1d4ed8");
    await expect.element(textInput()).not.toHaveAttribute("aria-invalid");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("Escape reverts the text and claims the Escape only when the text differed", async () => {
    const onValueChange = vi.fn();
    const escapes: KeyboardEvent[] = [];
    const record = (event: KeyboardEvent) => {
      if (event.key === "Escape") escapes.push(event);
    };
    window.addEventListener("keydown", record);
    try {
      await render(<ColorPicker defaultValue="#1d4ed8" onValueChange={onValueChange} />);
      await userEvent.fill(textInput(), "#00ff00");
      await userEvent.keyboard("{Escape}");
      await expect.element(textInput()).toHaveValue("#1d4ed8");
      await userEvent.keyboard("{Escape}");
    } finally {
      window.removeEventListener("keydown", record);
    }
    expect(onValueChange).not.toHaveBeenCalled();
    const details = (event: Event) => ({
      reason: "escape-key",
      event,
      cancel: () => {},
      allowPropagation: () => {},
    });
    expect(escapes).toHaveLength(2);
    // An enclosing Tessera overlay yields the first Escape (it reverted the text), not the second.
    expect(yieldEscapeToTooltip(false, details(escapes[0] as KeyboardEvent))).toBe(true);
    expect(yieldEscapeToTooltip(false, details(escapes[1] as KeyboardEvent))).toBe(false);
  });

  it("Enter submits the form when nothing was typed, not when it commits an edit", async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    await render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)} aria-label="Theme">
        <ColorPicker defaultValue="#1d4ed8" />
        <button type="submit">Save</button>
      </form>,
    );
    await userEvent.fill(textInput(), "#ff0000");
    await userEvent.keyboard("{Enter}");
    await expect.element(textInput()).toHaveValue("#ff0000");
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("ColorInput's own format pins its display format", async () => {
    await render(
      <ColorPicker defaultValue="#ff0000">
        <ColorInput format="rgb" />
      </ColorPicker>,
    );
    await expect.element(textInput()).toHaveValue("rgb(255 0 0)");
  });
});

describe("ColorPicker format toggle", () => {
  it("HSL shows hsl(…) and reports the format", async () => {
    const onFormatChange = vi.fn();
    await render(<ColorPicker defaultValue="#ff0000" onFormatChange={onFormatChange} />);
    const group = page.getByRole("group", { name: "Color format" });
    await expect.element(group).toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "HEX" }))
      .toHaveAttribute("aria-pressed", "true");
    await userEvent.click(page.getByRole("button", { name: "HSL" }));
    await expect.element(textInput()).toHaveValue("hsl(0 100% 50%)");
    expect(onFormatChange).toHaveBeenLastCalledWith("hsl");
    await expect
      .element(page.getByRole("button", { name: "HSL" }))
      .toHaveAttribute("aria-pressed", "true");
    // Pressing the pressed item keeps it (never empty).
    await userEvent.click(page.getByRole("button", { name: "HSL" }));
    await expect
      .element(page.getByRole("button", { name: "HSL" }))
      .toHaveAttribute("aria-pressed", "true");
    await expect.element(textInput()).toHaveValue("hsl(0 100% 50%)");
  });

  it("← / → move within it", async () => {
    await render(<ColorPicker />);
    const hex = page.getByRole("button", { name: "HEX" });
    hex.element().focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect
      .poll(() => document.activeElement)
      .toBe(page.getByRole("button", { name: "RGB" }).element());
    await userEvent.keyboard("{ArrowLeft}");
    await expect.poll(() => document.activeElement).toBe(hex.element());
  });

  it("formatLabel localises the items", async () => {
    const labels = { hex: "Hex", rgb: "RVB", hsl: "TSL" } as const;
    await render(
      <ColorPicker>
        <ColorFormatToggle formatLabel={(format) => labels[format]} />
      </ColorPicker>,
    );
    for (const name of ["Hex", "RVB", "TSL"]) {
      await expect.element(page.getByRole("button", { name, exact: true })).toBeInTheDocument();
    }
  });

  it("format (controlled) and defaultFormat", async () => {
    const onFormatChange = vi.fn();
    const screen = await render(
      <ColorPicker defaultValue="#ff0000" format="rgb" onFormatChange={onFormatChange} />,
    );
    await expect.element(textInput()).toHaveValue("rgb(255 0 0)");
    await userEvent.click(page.getByRole("button", { name: "HSL" }));
    expect(onFormatChange).toHaveBeenLastCalledWith("hsl");
    await expect.element(textInput()).toHaveValue("rgb(255 0 0)");
    await screen.unmount();
    await render(<ColorPicker defaultValue="#ff0000" defaultFormat="hsl" />);
    await expect.element(textInput()).toHaveValue("hsl(0 100% 50%)");
  });
});

describe("ColorPicker swatches", () => {
  const swatches = ["#ff0000", { value: "#1d4ed8", label: "Brand blue" }];

  it("are named by their label (default the hex); none is pressed for another value", async () => {
    await render(<ColorPicker swatches={swatches} />);
    await expect
      .element(page.getByRole("group", { name: "Swatches" }))
      .toHaveAttribute("data-slot", "color-swatches");
    const red = page.getByRole("button", { name: "#ff0000" });
    const blue = page.getByRole("button", { name: "Brand blue" });
    await expect.element(red).toHaveAttribute("aria-pressed", "false");
    await expect.element(blue).toHaveAttribute("aria-pressed", "false");
    expect(red.element().querySelector("svg")).toBeNull();
  });

  it("pressing one sets and commits; the pressed one shows a check; pressing it again does nothing", async () => {
    const onValueCommitted = vi.fn();
    await render(<ColorPicker swatches={swatches} onValueCommitted={onValueCommitted} />);
    const blue = page.getByRole("button", { name: "Brand blue" });
    await userEvent.click(blue);
    await expect.element(blue).toHaveAttribute("aria-pressed", "true");
    await expect.element(textInput()).toHaveValue("#1d4ed8");
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
    expect(onValueCommitted).toHaveBeenLastCalledWith("#1d4ed8");
    const check = blue.element().querySelector("svg") as SVGElement;
    expect(check).not.toBeNull();
    // readableForeground(#1d4ed8) is white.
    expect(getComputedStyle(check).color).toBe("rgb(255, 255, 255)");
    await userEvent.click(blue);
    await expect.element(blue).toHaveAttribute("aria-pressed", "true");
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
  });

  it("an unparsable swatch renders nothing, with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await render(<ColorPicker swatches={["#ff0000", "tomato", "#00ff00"]} />);
    await expect.element(page.getByRole("button", { name: "#00ff00" })).toBeInTheDocument();
    expect(slots("color-swatch")).toHaveLength(2);
    expect(page.getByRole("button", { name: "tomato" }).query()).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("tomato"));
  });

  it("a value matching a swatch (normalised) presses it", async () => {
    await render(<ColorPicker defaultValue="#1D4ED8" swatches={swatches} />);
    await expect
      .element(page.getByRole("button", { name: "Brand blue" }))
      .toHaveAttribute("aria-pressed", "true");
  });
});

describe("ColorPicker EyeDropper", () => {
  const button = () => page.getByRole("button", { name: "Pick a color from the screen" });

  it("is absent without the EyeDropper API", async () => {
    removeEyeDropper();
    await render(<ColorPicker />);
    await expect.element(textInput()).toBeInTheDocument();
    await expect.element(button()).not.toBeInTheDocument();
  });

  it("sets and commits the picked colour; aria-disabled and focused while picking", async () => {
    let resolve: (result: { sRGBHex: string }) => void = () => {};
    const open = vi.fn(
      () =>
        new Promise<{ sRGBHex: string }>((done) => {
          resolve = done;
        }),
    );
    stubEyeDropper(open);
    const onValueCommitted = vi.fn();
    await render(
      <Form aria-label="Theme">
        <Field name="accent">
          <FieldLabel>Accent</FieldLabel>
          <ColorPicker onValueCommitted={onValueCommitted} />
        </Field>
      </Form>,
    );
    const field = slot("field") as HTMLElement;
    await expect.element(button()).toHaveAttribute("data-slot", "color-eye-dropper");
    await userEvent.click(button());
    await expect.element(button()).toHaveAttribute("aria-disabled", "true");
    // Focus stays on the button (not natively disabled), so the Field is not touched mid-pick.
    expect(document.activeElement).toBe(button().element());
    expect(field.hasAttribute("data-touched")).toBe(false);
    // A second click while picking is ignored. Its text is muted, not faded.
    await userEvent.click(button(), { force: true });
    expect(open).toHaveBeenCalledTimes(1);
    expect(getComputedStyle(button().element()).opacity).toBe("1");
    resolve({ sRGBHex: "#1d4ed8" });
    await expect.element(textInput()).toHaveValue("#1d4ed8");
    await expect.element(button()).not.toHaveAttribute("aria-disabled");
    expect(document.activeElement).toBe(button().element());
    expect(onValueCommitted).toHaveBeenCalledWith("#1d4ed8");
  });

  it("swallows other rejections (NotAllowedError) with a warning, not an unhandled error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubEyeDropper(() => Promise.reject(new DOMException("No", "NotAllowedError")));
    const onValueChange = vi.fn();
    await render(<ColorPicker defaultValue="#1d4ed8" onValueChange={onValueChange} />);
    await userEvent.click(button());
    await expect.poll(() => warn.mock.calls.length).toBe(1);
    await expect.element(button()).not.toHaveAttribute("aria-disabled");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("a pick that resolves after unmount changes nothing", async () => {
    let resolve: (result: { sRGBHex: string }) => void = () => {};
    let settled = Promise.resolve();
    stubEyeDropper(() => {
      const pick = new Promise<{ sRGBHex: string }>((done) => {
        resolve = done;
      });
      settled = pick.then(() => {});
      return pick;
    });
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();
    const error = vi.spyOn(console, "error");
    const screen = await render(
      <ColorPicker onValueChange={onValueChange} onValueCommitted={onValueCommitted} />,
    );
    await userEvent.click(button());
    await screen.unmount();
    resolve({ sRGBHex: "#1d4ed8" });
    // The component's continuation was queued on the same promise right after `settled`'s, so it
    // has run by the time these microtasks drain (no timer involved).
    await settled;
    await Promise.resolve();
    await Promise.resolve();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommitted).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("ignores an AbortError (the user pressed Escape)", async () => {
    stubEyeDropper(() => Promise.reject(new DOMException("Canceled", "AbortError")));
    const onValueChange = vi.fn();
    await render(<ColorPicker defaultValue="#1d4ed8" onValueChange={onValueChange} />);
    await userEvent.click(button());
    await expect.element(button()).not.toHaveAttribute("aria-disabled");
    await expect.element(textInput()).toHaveValue("#1d4ed8");
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("ColorPicker controlled and uncontrolled", () => {
  it("defaultValue seeds an uncontrolled picker that then follows its own changes", async () => {
    await render(<ColorPicker defaultValue="#804040" />);
    await expect.element(textInput()).toHaveValue("#804040");
    await userEvent.tab();
    await userEvent.keyboard("{End}");
    await expect.element(textInput()).toHaveValue(hexOf(0, 100, 50));
  });

  it("value + onValueChange: the parent's state drives the picker", async () => {
    function Controlled() {
      const [value, setValue] = useState("#804040");
      return (
        <>
          <ColorPicker value={value} onValueChange={setValue} />
          <output data-testid="value">{value}</output>
        </>
      );
    }
    const screen = await render(<Controlled />);
    await userEvent.tab();
    await userEvent.keyboard("{End}");
    await expect.element(screen.getByTestId("value")).toHaveTextContent(hexOf(0, 100, 50));
    await expect.element(textInput()).toHaveValue(hexOf(0, 100, 50));
  });

  it("a controlled parent that ignores changes keeps the thumb where value puts it", async () => {
    const onValueChange = vi.fn();
    await render(<ColorPicker value="#ff0000" onValueChange={onValueChange} />);
    const thumb = areaThumb().element();
    const before = centreX(thumb);
    await userEvent.tab();
    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    expect(onValueChange).toHaveBeenLastCalledWith(hexOf(0, 90, 100));
    await expect.element(areaThumb()).toHaveAttribute("aria-valuenow", "100");
    expect(centreX(thumb)).toBe(before);
    await expect.element(textInput()).toHaveValue("#ff0000");
  });

  it("a controlled value change replaces the state; a grey keeps the hue", async () => {
    const screen = await render(<ColorPicker value="#0080ff" />);
    await expect.element(hueThumb()).toHaveAttribute("aria-valuenow", "210");
    await screen.rerender(<ColorPicker value="#808080" />);
    await expect.element(areaThumb()).toHaveAttribute("aria-valuenow", "0");
    await expect.element(hueThumb()).toHaveAttribute("aria-valuenow", "210");
    await screen.rerender(<ColorPicker value="#ff0000" />);
    await expect.element(hueThumb()).toHaveAttribute("aria-valuenow", "0");
  });

  it("a grey after an outside change keeps the hue on screen, not the last internal one", async () => {
    // A (hue 210) → non-grey B (hue 0), both from outside → grey C: the hue stays 0.
    const onValueChange = vi.fn();
    const screen = await render(<ColorPicker value="#0080ff" onValueChange={onValueChange} />);
    await expect.element(hueThumb()).toHaveAttribute("aria-valuenow", "210");
    await screen.rerender(<ColorPicker value="#ff0000" onValueChange={onValueChange} />);
    await expect.element(hueThumb()).toHaveAttribute("aria-valuenow", "0");
    await screen.rerender(<ColorPicker value="#808080" onValueChange={onValueChange} />);
    await expect.element(areaThumb()).toHaveAttribute("aria-valuenow", "0");
    await expect.element(hueThumb()).toHaveAttribute("aria-valuenow", "0");
    // Adopting an outside value reports nothing back.
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("a controlled parent that rejects a hue change keeps the value's hue for a later grey", async () => {
    const onValueChange = vi.fn();
    const screen = await render(<ColorPicker value="#0080ff" onValueChange={onValueChange} />);
    hueThumb().element().focus();
    await userEvent.keyboard("{Home}");
    expect(onValueChange).toHaveBeenLastCalledWith("#ff0000");
    // Rejected: the slider shows the value's hue.
    await expect.element(hueThumb()).toHaveAttribute("aria-valuenow", "210");
    await screen.rerender(<ColorPicker value="#808080" onValueChange={onValueChange} />);
    await expect.element(hueThumb()).toHaveAttribute("aria-valuenow", "210");
  });

  it("uncontrolled: a grey after a swatch keeps the swatch's hue", async () => {
    await render(<ColorPicker defaultValue="#0080ff" swatches={["#ff0000"]} />);
    await userEvent.click(page.getByRole("button", { name: "#ff0000" }));
    await expect.element(hueThumb()).toHaveAttribute("aria-valuenow", "0");
    await userEvent.fill(textInput(), "#808080");
    await userEvent.keyboard("{Enter}");
    await expect.element(areaThumb()).toHaveAttribute("aria-valuenow", "0");
    await expect.element(hueThumb()).toHaveAttribute("aria-valuenow", "0");
  });

  it("an unparsable value is ignored with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await render(<ColorPicker value="tomato" />);
    await expect.element(textInput()).toHaveValue("#000000");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("tomato"));
  });

  it("alpha off drops an incoming alpha; alpha on keeps it", async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <ColorPicker defaultValue="#ff000080" onValueChange={onValueChange} />,
    );
    await expect.element(textInput()).toHaveValue("#ff0000");
    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}");
    expect(onValueChange).toHaveBeenLastCalledWith(hexOf(0, 100, 99));
    await screen.unmount();
    await render(<ColorPicker alpha defaultValue="#ff000080" />);
    await expect.element(textInput()).toHaveValue("#ff000080");
  });
});

/** Reads the enclosing Form's registered field controls (Base UI's form context). */
function RegisteredControls({ onRead }: { onRead: (count: number) => void }) {
  const { formRef } = useFormContext();
  return (
    <button type="button" onClick={() => onRead(formRef.current.fields.size)}>
      Count controls
    </button>
  );
}

describe("ColorPicker in a form", () => {
  it("name submits the hex through native FormData", async () => {
    let data: FormData | null = null;
    await render(
      <form
        aria-label="Theme"
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <ColorPicker name="accent" defaultValue="#1d4ed8" />
        <button type="submit">Save</button>
      </form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(data).not.toBeNull());
    expect((data as unknown as FormData).getAll("accent")).toEqual(["#1d4ed8"]);
    expect(slot("color-picker-form-control")?.getAttribute("name")).toBe("accent");
  });

  it("form associates the hidden input with a form elsewhere in the document", async () => {
    let data: FormData | null = null;
    await render(
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
        <ColorPicker name="accent" form="theme-form" defaultValue="#1d4ed8" />
      </>,
    );
    expect(slot("color-picker-form-control")?.getAttribute("form")).toBe("theme-form");
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(data).not.toBeNull());
    expect((data as unknown as FormData).getAll("accent")).toEqual(["#1d4ed8"]);
  });

  it("disabled submits nothing", async () => {
    let data: FormData | null = null;
    await render(
      <form
        aria-label="Theme"
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <ColorPicker name="accent" defaultValue="#1d4ed8" disabled />
        <button type="submit">Save</button>
      </form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(data).not.toBeNull());
    expect((data as unknown as FormData).has("accent")).toBe(false);
  });

  it("in a Field in a Form: one control, one FormData entry, onFormSubmit under the Field name", async () => {
    const onFormSubmit = vi.fn();
    let native: FormData | null = null;
    let controls = -1;
    await render(
      <Form
        aria-label="Theme"
        onFormSubmit={onFormSubmit}
        onSubmit={(event) => {
          native = new FormData(event.currentTarget);
        }}
      >
        <Field name="accent">
          <FieldLabel>Accent</FieldLabel>
          <ColorPicker alpha defaultValue="#1d4ed8" swatches={["#ff0000"]} />
        </Field>
        <RegisteredControls
          onRead={(count) => {
            controls = count;
          }}
        />
        <Button type="submit">Save</Button>
      </Form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Count controls" }));
    expect(controls).toBe(1);
    expect(slots("color-picker-form-control")).toHaveLength(1);
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1));
    expect(onFormSubmit.mock.calls[0]?.[0]).toEqual({ accent: "#1d4ed8" });
    expect((native as unknown as FormData).getAll("accent")).toEqual(["#1d4ed8"]);
    expect([...(native as unknown as FormData).keys()]).toEqual(["accent"]);
  });

  it("the Field label names the root group and the description describes it", async () => {
    await render(
      <Field>
        <FieldLabel>Accent</FieldLabel>
        <ColorPicker defaultValue="#1d4ed8" />
        <FieldDescription>Used for links and buttons.</FieldDescription>
      </Field>,
    );
    const group = page.getByRole("group", { name: "Accent" });
    await expect.element(group).toHaveAttribute("data-slot", "color-picker");
    await expect.element(group).toHaveAccessibleDescription("Used for links and buttons.");
    const label = slot("field-label") as HTMLLabelElement;
    expect(group.element().getAttribute("aria-labelledby")).toBe(label.id);
    expect(group.element().hasAttribute("aria-label")).toBe(false);
    // The group is not labelable: the label points at no control.
    expect(label.htmlFor).toBe("");
  });

  it("a Field validate that rejects focuses the area thumb on submit", async () => {
    const onFormSubmit = vi.fn();
    const validate = vi.fn((_value: unknown) => "Pick a darker colour");
    await render(
      <Form aria-label="Theme" onFormSubmit={onFormSubmit}>
        <Field name="accent" validate={validate}>
          <FieldLabel>Accent</FieldLabel>
          <ColorPicker defaultValue="#ffff66" />
          <FieldError />
        </Field>
        <Button type="submit">Save</Button>
      </Form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.element(page.getByText("Pick a darker colour")).toBeVisible();
    expect(onFormSubmit).not.toHaveBeenCalled();
    expect(validate.mock.lastCall?.[0]).toBe("#ffff66");
    await expect.poll(() => document.activeElement).toBe(areaThumb().element());
  });

  it("the Field's blur (touched) fires when focus leaves the picker, not between its parts", async () => {
    removeEyeDropper();
    await render(
      <Form aria-label="Theme">
        <Field name="accent">
          <FieldLabel>Accent</FieldLabel>
          <ColorPicker defaultValue="#1d4ed8" />
        </Field>
        <Button type="button">After</Button>
      </Form>,
    );
    const field = slot("field") as HTMLElement;
    await userEvent.tab();
    expect(document.activeElement).toBe(areaThumb().element());
    await userEvent.tab();
    expect(document.activeElement).toBe(hueThumb().element());
    expect(field.hasAttribute("data-touched")).toBe(false);
    await userEvent.tab();
    await userEvent.tab();
    expect(field.hasAttribute("data-touched")).toBe(false);
    // Out past the format toggle (one Tab stop) to the button after the picker.
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("button", { name: "After" }).element());
    await expect.poll(() => field.hasAttribute("data-touched")).toBe(true);
  });

  it("a disabled Field disables the picker", async () => {
    await render(
      <Field disabled>
        <FieldLabel>Accent</FieldLabel>
        <ColorPicker swatches={["#ff0000"]} />
      </Field>,
    );
    await expect.element(areaThumb()).toHaveAttribute("aria-disabled", "true");
    expect(slot("color-picker")?.hasAttribute("data-disabled")).toBe(true);
  });

  it("a picker told not to join (the popover's inner picker) adds no control or labelling", async () => {
    let controls = -1;
    await render(
      <Form aria-label="Theme">
        <Field name="accent">
          <FieldLabel>Accent</FieldLabel>
          <ColorPickerHostContext.Provider value={{ joinsForm: false }}>
            <ColorPicker name="inner" defaultValue="#1d4ed8" />
          </ColorPickerHostContext.Provider>
        </Field>
        <RegisteredControls
          onRead={(count) => {
            controls = count;
          }}
        />
      </Form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Count controls" }));
    expect(controls).toBe(0);
    expect(slot("color-picker-form-control")).toBeNull();
    await expect.element(page.getByRole("group", { name: "Color picker" })).toBeInTheDocument();
    expect(slot("color-picker")?.hasAttribute("aria-labelledby")).toBe(false);
  });
});

describe("ColorPicker disabled", () => {
  it("every part ignores input; thumbs are aria-disabled and out of the Tab order", async () => {
    stubEyeDropper(() => Promise.resolve({ sRGBHex: "#ffffff" }));
    const onValueChange = vi.fn();
    await render(
      <>
        <ColorPicker
          alpha
          disabled
          defaultValue="#1d4ed8"
          swatches={["#ff0000"]}
          onValueChange={onValueChange}
        />
        <button type="button">After</button>
      </>,
    );
    const root = slot("color-picker") as HTMLElement;
    expect(root.hasAttribute("data-disabled")).toBe(true);
    // The root's 50% is the only fade; the inner controls do not fade a second time.
    expect(getComputedStyle(root).opacity).toBe("0.5");
    for (const element of [
      textInput().element(),
      page.getByRole("button", { name: "HEX" }).element(),
      page.getByRole("button", { name: "#ff0000" }).element(),
      page.getByRole("button", { name: "Pick a color from the screen" }).element(),
    ]) {
      expect(getComputedStyle(element).opacity).toBe("1");
    }
    for (const thumb of [areaThumb(), hueThumb(), alphaThumb()]) {
      await expect.element(thumb).toHaveAttribute("aria-disabled", "true");
      await expect.element(thumb).toHaveAttribute("tabindex", "-1");
    }
    await expect.element(textInput()).toBeDisabled();
    await expect.element(page.getByRole("button", { name: "HEX" })).toBeDisabled();
    await expect.element(page.getByRole("button", { name: "#ff0000" })).toBeDisabled();
    await expect
      .element(page.getByRole("button", { name: "Pick a color from the screen" }))
      .toBeDisabled();
    // Tab skips the whole picker.
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("button", { name: "After" }).element());
    // Pointer and keys do nothing.
    const area = slot("color-area") as HTMLElement;
    const rect = area.getBoundingClientRect();
    await userEvent.click(page.elementLocator(area), {
      position: { x: 4, y: rect.height - 4 },
      force: true,
    });
    areaThumb().element().focus();
    await userEvent.keyboard("{Home}");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(getComputedStyle(area).cursor).toBe("not-allowed");
  });
});

describe("ColorPicker disabled fade", () => {
  it("a consumer's own opacity on a composed child survives a disabled picker", async () => {
    stubEyeDropper(() => Promise.resolve({ sRGBHex: "#ffffff" }));
    await render(
      <ColorPicker disabled defaultValue="#1d4ed8" swatches={["#ff0000"]}>
        <p data-testid="note" className="opacity-75">
          Brand colour
        </p>
        <div data-testid="frame" data-disabled="" className="opacity-60 data-disabled:opacity-40">
          <ColorInput />
        </div>
        <ColorFormatToggle />
        <ColorEyeDropper />
        <ColorSwatches />
      </ColorPicker>,
    );
    expect(getComputedStyle(slot("color-picker") as HTMLElement).opacity).toBe("0.5");
    expect(getComputedStyle(page.getByTestId("note").element()).opacity).toBe("0.75");
    expect(getComputedStyle(page.getByTestId("frame").element()).opacity).toBe("0.4");
    for (const element of [
      textInput().element(),
      page.getByRole("button", { name: "HEX" }).element(),
      page.getByRole("button", { name: "#ff0000" }).element(),
      page.getByRole("button", { name: "Pick a color from the screen" }).element(),
    ]) {
      expect(getComputedStyle(element).opacity).toBe("1");
    }
  });

  it("a part disabled on its own (picker enabled) fades itself", async () => {
    await render(
      <ColorPicker defaultValue="#1d4ed8">
        <ColorInput disabled />
      </ColorPicker>,
    );
    await expect.element(textInput()).toBeDisabled();
    expect(getComputedStyle(textInput().element()).opacity).toBe("0.5");
  });
});

describe("ColorPicker styles", () => {
  it("Tab to each thumb shows a 2px solid focus ring", async () => {
    await render(<ColorPicker alpha />);
    for (const thumb of [areaThumb(), hueThumb(), alphaThumb()]) {
      expect(getComputedStyle(thumb.element()).outlineStyle).toBe("none");
      await userEvent.tab();
      expect(document.activeElement).toBe(thumb.element());
      const style = getComputedStyle(thumb.element());
      expect(style.outlineStyle).toBe("solid");
      expect(style.outlineWidth).toBe("2px");
    }
  });

  it("the thumbs have no transitions; the swatches have none under reduced motion", async () => {
    await render(<ColorPicker alpha swatches={["#ff0000"]} />);
    for (const thumb of [areaThumb(), hueThumb(), alphaThumb()]) {
      expect(getComputedStyle(thumb.element()).transitionDuration).toBe("0s");
    }
    const swatch = slot("color-swatch") as HTMLElement;
    expect(getComputedStyle(swatch).transitionProperty).toBe("border-color, outline-color");
    expect(getComputedStyle(swatch).transitionDuration).toBe("0.15s");
    await emulateReducedMotion(true);
    // `transition-none` turns the property off (the duration class still applies).
    expect(getComputedStyle(swatch).transitionProperty).toBe("none");
  });

  it("the alpha track and a translucent swatch sit on the checkerboard", async () => {
    await render(<ColorPicker alpha defaultValue="#1d4ed880" swatches={["#ff000080"]} />);
    const track = slot("color-alpha-slider") as HTMLElement;
    expect(getComputedStyle(track).backgroundImage).toContain("conic-gradient");
    expect(getComputedStyle(track).backgroundSize).toBe("8px 8px");
    const swatch = slot("color-swatch") as HTMLElement;
    expect(getComputedStyle(swatch).backgroundImage).toContain("conic-gradient");
  });

  it("forced colors: the surfaces keep their gradients with CanvasText frames", async () => {
    await emulateForcedColors(true);
    await render(<ColorPicker alpha defaultValue="#1d4ed8" swatches={["#1d4ed8", "#ff0000"]} />);
    const canvasText = systemColor("CanvasText");
    const area = getComputedStyle(slot("color-area") as HTMLElement);
    expect(area.forcedColorAdjust).toBe("none");
    expect(area.backgroundImage).toContain("linear-gradient");
    expect(area.borderTopStyle).toBe("solid");
    expect(area.borderTopColor).toBe(canvasText);
    for (const name of ["color-hue-slider", "color-alpha-slider"]) {
      const track = getComputedStyle(slot(name) as HTMLElement);
      expect(track.forcedColorAdjust).toBe("none");
      expect(track.outlineStyle).toBe("solid");
      expect(track.outlineWidth).toBe("1px");
      expect(track.outlineColor).toBe(canvasText);
    }
    expect(getComputedStyle(slot("color-hue-slider") as HTMLElement).backgroundImage).toContain(
      "linear-gradient",
    );
    // The pressed swatch keeps its colour with a Highlight border.
    const pressed = page.getByRole("button", { name: "#1d4ed8" }).element();
    const swatch = getComputedStyle(pressed);
    expect(swatch.forcedColorAdjust).toBe("none");
    expect(swatch.borderTopColor).toBe(systemColor("Highlight"));
    expect(swatch.backgroundColor).toBe("rgb(29, 78, 216)");
  });

  it("forced colors: thumbs have a CanvasText border and a Highlight ring only when focused", async () => {
    await emulateForcedColors(true);
    await render(<ColorPicker alpha />);
    for (const thumb of [areaThumb(), hueThumb(), alphaThumb()]) {
      const element = thumb.element();
      expect(getComputedStyle(element).outlineStyle).toBe("none");
      expect(getComputedStyle(element).borderTopColor).toBe(systemColor("CanvasText"));
      await userEvent.tab();
      expect(document.activeElement).toBe(element);
      expect(getComputedStyle(element).outlineStyle).toBe("solid");
      expect(getComputedStyle(element).outlineColor).toBe(systemColor("Highlight"));
    }
  });
});

describe("ColorPicker axe", () => {
  async function audit(container: Element) {
    const results = await axe.run(container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  }

  it.each(["light", "dark"] as const)("has no violations in the %s theme", async (theme) => {
    stubEyeDropper(() => Promise.resolve({ sRGBHex: "#ffffff" }));
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <ColorPicker
          alpha
          defaultValue="#1d4ed880"
          swatches={["#1d4ed8", { value: "#16a34a", label: "Green" }, "#f59e0b80"]}
        />
        <ColorPicker disabled defaultValue="#ff0000" aria-label="Disabled colour" />
        <Field>
          <FieldLabel>Accent</FieldLabel>
          <ColorPicker name="accent" defaultValue="#1d4ed8" />
          <FieldDescription>Used for links and buttons.</FieldDescription>
        </Field>
        <ColorPicker defaultValue="#1d4ed8">
          <ColorArea />
          <ColorHueSlider />
          <ColorInput />
          <ColorFormatToggle />
          <ColorEyeDropper />
        </ColorPicker>
      </div>,
    );
    await expect.element(page.getByRole("group", { name: "Accent" })).toBeInTheDocument();
    await audit(screen.container);
  });
});
