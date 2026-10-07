import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, resetEmulatedMedia, systemColor } from "../../../test/emulation";
import { Field, FieldLabel } from "../field";
import { Slider, SliderLabel, SliderValue } from "./slider";

const trackOf = (root: Element) => root.querySelector('[data-slot="slider-track"]') as HTMLElement;
const indicatorOf = (root: Element) =>
  root.querySelector('[data-slot="slider-indicator"]') as HTMLElement;
const thumbsOf = (root: Element) =>
  [...root.querySelectorAll('[data-slot="slider-thumb"]')] as HTMLElement[];
const inputOf = (thumb: Element) => thumb.querySelector("input") as HTMLInputElement;

afterEach(async () => {
  await resetEmulatedMedia();
});

describe("Slider", () => {
  it("renders a slider role with aria-valuenow/min/max and data-slot", async () => {
    const screen = await render(<Slider defaultValue={40} aria-label="Volume" />);
    const thumb = screen.getByRole("slider", { name: "Volume" });
    await expect.element(thumb).toHaveAttribute("aria-valuenow", "40");
    // Native `<input type="range">`: min/max are exposed to the accessibility tree implicitly
    // from the HTML `min`/`max` attributes rather than literal `aria-valuemin`/`aria-valuemax`.
    await expect.element(thumb).toHaveAttribute("min", "0");
    await expect.element(thumb).toHaveAttribute("max", "100");
    const root = thumb.element().closest('[data-slot="slider"]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(trackOf(root)).not.toBeNull();
    expect(indicatorOf(root)).not.toBeNull();
    expect(thumbsOf(root)).toHaveLength(1);
  });

  it("changes the value with arrow keys, PageUp/PageDown, Home and End", async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <Slider defaultValue={50} aria-label="Level" onValueChange={onValueChange} />,
    );
    const thumb = screen.getByRole("slider", { name: "Level" });
    (thumb.element() as HTMLElement).focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(thumb).toHaveAttribute("aria-valuenow", "51");
    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(thumb).toHaveAttribute("aria-valuenow", "50");
    await userEvent.keyboard("{PageUp}");
    await expect.element(thumb).toHaveAttribute("aria-valuenow", "60");
    await userEvent.keyboard("{PageDown}");
    await expect.element(thumb).toHaveAttribute("aria-valuenow", "50");
    await userEvent.keyboard("{Home}");
    await expect.element(thumb).toHaveAttribute("aria-valuenow", "0");
    await userEvent.keyboard("{End}");
    await expect.element(thumb).toHaveAttribute("aria-valuenow", "100");
    expect(onValueChange).toHaveBeenCalled();
  });

  it("renders a range slider with two thumbs given distinct names", async () => {
    const screen = await render(
      <Slider defaultValue={[20, 80]} thumbLabels={["Minimum price", "Maximum price"]} />,
    );
    const min = screen.getByRole("slider", { name: "Minimum price" });
    const max = screen.getByRole("slider", { name: "Maximum price" });
    await expect.element(min).toHaveAttribute("aria-valuenow", "20");
    await expect.element(max).toHaveAttribute("aria-valuenow", "80");
    expect(min.element()).not.toBe(max.element());
  });

  it("derives min/max thumb names for a 2-thumb range from a group aria-label, and names the group", async () => {
    const screen = await render(<Slider defaultValue={[20, 80]} aria-label="Price" />);
    const min = screen.getByRole("slider", { name: "Price minimum" });
    const max = screen.getByRole("slider", { name: "Price maximum" });
    await expect.element(min).toHaveAttribute("aria-valuenow", "20");
    await expect.element(max).toHaveAttribute("aria-valuenow", "80");
    const group = min.element().closest('[data-slot="slider"]') as HTMLElement;
    expect(group.getAttribute("aria-label")).toBe("Price");
  });

  it("derives numbered thumb names for 3+ thumbs from a group aria-label", async () => {
    const screen = await render(<Slider defaultValue={[10, 40, 90]} aria-label="Stops" />);
    await expect
      .element(screen.getByRole("slider", { name: "Stops 1" }))
      .toHaveAttribute("aria-valuenow", "10");
    await expect
      .element(screen.getByRole("slider", { name: "Stops 2" }))
      .toHaveAttribute("aria-valuenow", "40");
    await expect
      .element(screen.getByRole("slider", { name: "Stops 3" }))
      .toHaveAttribute("aria-valuenow", "90");
  });

  it("ignores interaction when disabled", async () => {
    const screen = await render(<Slider defaultValue={30} aria-label="Disabled" disabled />);
    const thumb = screen.getByRole("slider", { name: "Disabled" });
    await expect.element(thumb).toBeDisabled();
    const thumbWrapper = thumb.element().closest('[data-slot="slider-thumb"]') as HTMLElement;
    expect(thumbWrapper.hasAttribute("data-disabled")).toBe(true);
    const root = thumb.element().closest('[data-slot="slider"]') as HTMLElement;
    expect(getComputedStyle(root).opacity).toBe("0.5");
  });

  it("spans the indicator across the value within 1px", async () => {
    const screen = await render(<Slider defaultValue={30} aria-label="Level" className="w-80" />);
    const thumb = screen.getByRole("slider", { name: "Level" });
    const root = thumb.element().closest('[data-slot="slider"]') as HTMLElement;
    const track = trackOf(root);
    const indicator = indicatorOf(root);
    await expect
      .poll(() => indicator.getBoundingClientRect().width / track.getBoundingClientRect().width)
      .toBeCloseTo(0.3, 1);
    const trackRect = track.getBoundingClientRect();
    const indicatorRect = indicator.getBoundingClientRect();
    expect(Math.abs(indicatorRect.left - trackRect.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(indicatorRect.width - trackRect.width * 0.3)).toBeLessThanOrEqual(1);
  });

  it("does not clip the thumb inside the track's overflow-hidden band (horizontal)", async () => {
    const screen = await render(<Slider defaultValue={40} aria-label="Level" className="w-80" />);
    const thumb = screen.getByRole("slider", { name: "Level" });
    const thumbEl = thumb.element().closest('[data-slot="slider-thumb"]') as HTMLElement;
    const rect = thumbEl.getBoundingClientRect();
    // 2px inside the thumb's top edge: outside the (much thinner) track band the thumb used to
    // be clipped to when it rendered inside `Slider.Track`'s `overflow-hidden`.
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 2);
    expect(thumbEl.contains(hit)).toBe(true);
  });

  it("does not clip the thumb inside the track's overflow-hidden band (vertical)", async () => {
    const screen = await render(
      <div style={{ height: "16rem" }}>
        <Slider defaultValue={40} aria-label="Level" orientation="vertical" className="h-full" />
      </div>,
    );
    const thumb = screen.getByRole("slider", { name: "Level" });
    const thumbEl = thumb.element().closest('[data-slot="slider-thumb"]') as HTMLElement;
    const rect = thumbEl.getBoundingClientRect();
    // 2px inside the thumb's left edge: outside the (much thinner) vertical track band.
    const hit = document.elementFromPoint(rect.left + 2, rect.top + rect.height / 2);
    expect(thumbEl.contains(hit)).toBe(true);
  });

  it("is named by a wrapping Field's label and shows the formatted value", async () => {
    const screen = await render(
      <Field>
        <FieldLabel>Brightness</FieldLabel>
        <Slider defaultValue={70}>
          <SliderValue />
        </Slider>
      </Field>,
    );
    const thumb = screen.getByRole("slider", { name: "Brightness" });
    await expect.element(thumb).toBeInTheDocument();
    await expect.element(screen.getByText("70")).toHaveAttribute("data-slot", "slider-value");
  });

  it("is named by its SliderLabel", async () => {
    const screen = await render(
      <Slider defaultValue={10}>
        <SliderLabel>Zoom</SliderLabel>
      </Slider>,
    );
    const thumb = screen.getByRole("slider", { name: "Zoom" });
    await expect.element(thumb).toBeInTheDocument();
    await expect.element(screen.getByText("Zoom")).toHaveAttribute("data-slot", "slider-label");
  });

  it("submits its value with a form", async () => {
    const screen = await render(
      <form data-testid="form">
        <Slider name="volume" defaultValue={45} aria-label="Volume" />
      </form>,
    );
    const form = screen.getByTestId("form").element() as HTMLFormElement;
    expect(new FormData(form).get("volume")).toBe("45");
    const thumb = screen.getByRole("slider", { name: "Volume" });
    (thumb.element() as HTMLElement).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(new FormData(form).get("volume")).toBe("46");
  });

  it("defaults to the primary tone and applies other tones", async () => {
    const screen = await render(
      <div>
        <Slider defaultValue={40} aria-label="Default" />
        <Slider defaultValue={40} aria-label="Success" color="success" />
        <div data-testid="primary" className="bg-primary" />
        <div data-testid="success" className="bg-success" />
      </div>,
    );
    const defThumb = screen.getByRole("slider", { name: "Default" });
    const defRoot = defThumb.element().closest('[data-slot="slider"]') as HTMLElement;
    const successThumb = screen.getByRole("slider", { name: "Success" });
    const successRoot = successThumb.element().closest('[data-slot="slider"]') as HTMLElement;
    await expect.element(defRoot).toHaveAttribute("data-color", "primary");
    expect(defRoot).toHaveClass("tone-primary");
    expect(successRoot).toHaveClass("tone-success");
    const bg = (testId: string) =>
      getComputedStyle(screen.getByTestId(testId).element()).backgroundColor;
    expect(getComputedStyle(indicatorOf(defRoot)).backgroundColor).toBe(bg("primary"));
    expect(getComputedStyle(indicatorOf(successRoot)).backgroundColor).toBe(bg("success"));
  });

  it.each([
    ["sm", "h-1", "size-4"],
    ["md", "h-1.5", "size-5"],
  ] as const)("applies the %s size", async (size, trackCls, thumbCls) => {
    const screen = await render(<Slider defaultValue={30} size={size} aria-label="Level" />);
    const thumb = screen.getByRole("slider", { name: "Level" });
    const root = thumb.element().closest('[data-slot="slider"]') as HTMLElement;
    await expect.element(root).toHaveAttribute("data-size", size);
    expect(trackOf(root).classList).toContain(trackCls);
    const thumbEl = thumbsOf(root)[0];
    expect(thumbEl?.classList).toContain(thumbCls);
  });

  it("shows a cursor-grab thumb", async () => {
    const screen = await render(<Slider defaultValue={30} aria-label="Level" />);
    const thumb = screen.getByRole("slider", { name: "Level" });
    const thumbEl = thumb.element().closest('[data-slot="slider-thumb"]') as HTMLElement;
    expect(getComputedStyle(thumbEl).cursor).toBe("grab");
  });

  it("merges className and applies data-slot to every part", async () => {
    const screen = await render(
      <Slider defaultValue={40} aria-label="Level" className="max-w-40" />,
    );
    const thumb = screen.getByRole("slider", { name: "Level" });
    const root = thumb.element().closest('[data-slot="slider"]') as HTMLElement;
    await expect.element(root).toHaveClass("max-w-40");
    expect(root.getAttribute("data-slot")).toBe("slider");
    expect(root.querySelector('[data-slot="slider-control"]')).not.toBeNull();
    expect(trackOf(root).getAttribute("data-slot")).toBe("slider-track");
    expect(indicatorOf(root).getAttribute("data-slot")).toBe("slider-indicator");
  });

  it("shows a solid 2px outline on the thumb on Tab focus, targeting its hidden input", async () => {
    const screen = await render(<Slider defaultValue={40} aria-label="Level" />);
    const thumb = screen.getByRole("slider", { name: "Level" });
    const thumbEl = thumb.element().closest('[data-slot="slider-thumb"]') as HTMLElement;
    expect(getComputedStyle(thumbEl).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(inputOf(thumbEl));
    const style = getComputedStyle(thumbEl);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
  });

  it("shows no permanent outline in forced colors, only on focus, in the Highlight colour", async () => {
    await emulateForcedColors(true);
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    const screen = await render(<Slider defaultValue={40} aria-label="Level" />);
    const thumb = screen.getByRole("slider", { name: "Level" });
    const thumbEl = thumb.element().closest('[data-slot="slider-thumb"]') as HTMLElement;
    expect(getComputedStyle(thumbEl).outlineStyle).toBe("none");
    // The unfocused border is forced to CanvasText throughout (before and after focus).
    expect(getComputedStyle(thumbEl).borderColor).toBe(systemColor("CanvasText"));
    await userEvent.tab();
    expect(document.activeElement).toBe(inputOf(thumbEl));
    const style = getComputedStyle(thumbEl);
    expect(style.outlineStyle).toBe("solid");
    expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(1);
    // The focus ring must use a colour distinct from the border, or the focus change is
    // invisible in forced colors (the bug the `forced-colors:has-[:focus-visible]:outline-
    // [Highlight]` override exists to prevent).
    expect(style.outlineColor).toBe(systemColor("Highlight"));
    expect(style.outlineColor).not.toBe(style.borderColor);
    expect(getComputedStyle(thumbEl).borderColor).toBe(systemColor("CanvasText"));
  });

  it("keeps the track outline and indicator colour visible in forced colors", async () => {
    await emulateForcedColors(true);
    const screen = await render(<Slider defaultValue={40} aria-label="Level" />);
    const thumb = screen.getByRole("slider", { name: "Level" });
    const root = thumb.element().closest('[data-slot="slider"]') as HTMLElement;
    const canvas = systemColor("Canvas");
    const track = getComputedStyle(trackOf(root));
    expect(track.outlineStyle).toBe("solid");
    expect(track.outlineWidth).toBe("1px");
    expect(track.outlineColor).toBe(systemColor("CanvasText"));
    expect(track.outlineColor).not.toBe(canvas);
    const indicator = getComputedStyle(indicatorOf(root));
    expect(indicator.backgroundColor).toBe(systemColor("Highlight"));
    expect(indicator.backgroundColor).not.toBe(canvas);
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Slider defaultValue={40} color="success">
          <SliderLabel>Volume</SliderLabel>
          <SliderValue />
        </Slider>
        <Slider defaultValue={[20, 80]} thumbLabels={["Min", "Max"]} aria-label="Range" />
        <Slider defaultValue={[15, 85]} aria-label="Price" />
        <Slider defaultValue={30} disabled aria-label="Disabled" />
        <Field>
          <FieldLabel>Brightness</FieldLabel>
          <Slider defaultValue={70} />
        </Field>
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

describe("Slider direction", () => {
  const thumbCentre = (root: Element) => {
    const rect = (thumbsOf(root)[0] as HTMLElement).getBoundingClientRect();
    return rect.left + rect.width / 2;
  };

  // Base UI's SliderThumb.js: in a horizontal RTL slider → steps by -1 and ← by +1, so → moves
  // the thumb right, towards the lower values (the minimum sits at the inline start, the right).
  it("under dir=rtl, → lowers the value and ← raises it; the thumb sits from the right edge", async () => {
    const screen = await render(
      <div dir="rtl">
        <Slider defaultValue={30} aria-label="Level" className="w-80" />
      </div>,
    );
    const thumb = screen.getByRole("slider", { name: "Level" });
    const root = thumb.element().closest('[data-slot="slider"]') as HTMLElement;
    const track = trackOf(root).getBoundingClientRect();
    await expect
      .poll(() => Math.abs(thumbCentre(root) - (track.right - track.width * 0.3)))
      .toBeLessThanOrEqual(1);
    const indicator = indicatorOf(root).getBoundingClientRect();
    expect(Math.abs(indicator.right - track.right)).toBeLessThanOrEqual(1);
    (thumb.element() as HTMLElement).focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(thumb).toHaveAttribute("aria-valuenow", "29");
    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(thumb).toHaveAttribute("aria-valuenow", "30");
  });

  it("under dir=rtl, dragging the thumb to the left raises the value and keeps it under the pointer", async () => {
    const onValueCommitted = vi.fn();
    const screen = await render(
      <div dir="rtl" className="p-8">
        <Slider
          defaultValue={30}
          aria-label="Level"
          className="w-80"
          onValueCommitted={onValueCommitted}
        />
      </div>,
    );
    const thumb = screen.getByRole("slider", { name: "Level" });
    const root = thumb.element().closest('[data-slot="slider"]') as HTMLElement;
    const control = root.querySelector('[data-slot="slider-control"]') as HTMLElement;
    const rect = control.getBoundingClientRect();
    // 20% from the left edge is 80% of the way from the inline start (the right edge).
    const targetX = rect.width * 0.2;
    await userEvent.dragAndDrop(
      page.elementLocator(thumbsOf(root)[0] as HTMLElement),
      page.elementLocator(control),
      { force: true, targetPosition: { x: targetX, y: rect.height / 2 }, steps: 12 } as Parameters<
        typeof userEvent.dragAndDrop
      >[2],
    );
    await expect.poll(() => onValueCommitted.mock.calls.length).toBeGreaterThan(0);
    const value = Number(thumb.element().getAttribute("aria-valuenow"));
    expect(Math.abs(value - 80)).toBeLessThanOrEqual(1);
    expect(Math.abs(thumbCentre(root) - (rect.left + targetX))).toBeLessThanOrEqual(2);
  });

  it("LTR is unchanged: dragging to 20% from the left gives 20", async () => {
    const onValueCommitted = vi.fn();
    const screen = await render(
      <div className="p-8">
        <Slider
          defaultValue={30}
          aria-label="Level"
          className="w-80"
          onValueCommitted={onValueCommitted}
        />
      </div>,
    );
    const thumb = screen.getByRole("slider", { name: "Level" });
    const root = thumb.element().closest('[data-slot="slider"]') as HTMLElement;
    const control = root.querySelector('[data-slot="slider-control"]') as HTMLElement;
    const rect = control.getBoundingClientRect();
    await userEvent.dragAndDrop(
      page.elementLocator(thumbsOf(root)[0] as HTMLElement),
      page.elementLocator(control),
      {
        force: true,
        targetPosition: { x: rect.width * 0.2, y: rect.height / 2 },
        steps: 12,
      } as Parameters<typeof userEvent.dragAndDrop>[2],
    );
    await expect.poll(() => onValueCommitted.mock.calls.length).toBeGreaterThan(0);
    const value = Number(thumb.element().getAttribute("aria-valuenow"));
    expect(Math.abs(value - 20)).toBeLessThanOrEqual(1);
  });

  it("follows a dir change on an ancestor after mount", async () => {
    const screen = await render(
      <div data-testid="host">
        <Slider defaultValue={30} aria-label="Level" className="w-80" />
      </div>,
    );
    const thumb = screen.getByRole("slider", { name: "Level" });
    const root = thumb.element().closest('[data-slot="slider"]') as HTMLElement;
    screen.getByTestId("host").element().setAttribute("dir", "rtl");
    const track = trackOf(root).getBoundingClientRect();
    await expect
      .poll(() => Math.abs(thumbCentre(root) - (track.right - track.width * 0.3)))
      .toBeLessThanOrEqual(1);
    (thumb.element() as HTMLElement).focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(thumb).toHaveAttribute("aria-valuenow", "29");
  });
});
