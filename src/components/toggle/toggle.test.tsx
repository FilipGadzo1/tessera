import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, resetEmulatedMedia, systemColor } from "../../../test/emulation";
import { Toggle, ToggleGroup, ToggleGroupItem } from "./toggle";

/** Fraction of `element`'s screenshot whose pixels are near-white (a Canvas backplate, or Canvas itself). */
async function whitePixelFraction(element: Element): Promise<number> {
  const base64 = await page.screenshot({ element, save: false });
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let white = 0;
  const total = canvas.width * canvas.height;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    if (r > 235 && g > 235 && b > 235) white++;
  }
  return white / total;
}

afterEach(async () => {
  await resetEmulatedMedia();
});

describe("Toggle", () => {
  it("toggles aria-pressed on click", async () => {
    const onPressedChange = vi.fn();
    const screen = await render(<Toggle aria-label="Bold" onPressedChange={onPressedChange} />);
    const toggle = screen.getByRole("button", { name: "Bold" });
    await expect.element(toggle).toHaveAttribute("aria-pressed", "false");
    await expect.element(toggle).toHaveAttribute("data-slot", "toggle");
    await toggle.click();
    await expect.element(toggle).toHaveAttribute("aria-pressed", "true");
    expect(onPressedChange).toHaveBeenCalledWith(true, expect.anything());
  });

  it("toggles on Space and Enter", async () => {
    const screen = await render(<Toggle aria-label="Bold" />);
    const toggle = screen.getByRole("button", { name: "Bold" }).element() as HTMLElement;
    toggle.focus();
    await userEvent.keyboard(" ");
    await expect.element(toggle).toHaveAttribute("aria-pressed", "true");
    await userEvent.keyboard("{Enter}");
    await expect.element(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("defaults to the ghost variant and md size, and merges className", async () => {
    const screen = await render(<Toggle aria-label="Bold" className="max-w-40" />);
    const toggle = screen.getByRole("button", { name: "Bold" });
    await expect.element(toggle).toHaveAttribute("data-variant", "ghost");
    await expect.element(toggle).toHaveAttribute("data-size", "md");
    await expect.element(toggle).toHaveClass("max-w-40");
  });

  it.each([
    ["sm", 32],
    ["md", 40],
    ["lg", 48],
  ] as const)("has the same height as a Button at size %s", async (size, px) => {
    const screen = await render(<Toggle aria-label="Bold" size={size} />);
    const toggle = screen.getByRole("button", { name: "Bold" }).element();
    expect(toggle.getBoundingClientRect().height).toBe(px);
  });

  it("has cursor-pointer and a visible 2px focus ring on Tab-focus", async () => {
    const screen = await render(<Toggle aria-label="Bold" />);
    const toggle = screen.getByRole("button", { name: "Bold" }).element() as HTMLElement;
    expect(getComputedStyle(toggle).cursor).toBe("pointer");
    await userEvent.tab();
    expect(document.activeElement).toBe(toggle);
    const style = getComputedStyle(toggle);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
  });

  it("keeps a forced-colors focus outline on the outline variant, distinct from the idle border", async () => {
    await emulateForcedColors(true);
    const screen = await render(<Toggle aria-label="Bold" variant="outline" />);
    const toggle = screen.getByRole("button", { name: "Bold" }).element() as HTMLElement;
    const idleBorder = getComputedStyle(toggle).borderColor;
    await userEvent.tab();
    const focused = getComputedStyle(toggle);
    expect(focused.outlineColor).toBe(systemColor("Highlight"));
    expect(focused.outlineColor).not.toBe(idleBorder);
  });

  it("shows Highlight when pressed in forced colors, at rest and on hover", async () => {
    await emulateForcedColors(true);
    const screen = await render(<Toggle aria-label="Bold" defaultPressed />);
    const toggle = screen.getByRole("button", { name: "Bold" }).element() as HTMLElement;
    expect(getComputedStyle(toggle).backgroundColor).toBe(systemColor("Highlight"));
    await userEvent.hover(toggle);
    expect(getComputedStyle(toggle).backgroundColor).toBe(systemColor("Highlight"));
  });

  /*
   * *Amended (Task 6 fix round 1)*: Chromium paints a Canvas-coloured text backplate behind text
   * under forced colors whenever `forced-color-adjust` is `auto` (the default) — even when the
   * text's own colour is already the explicit system colour `HighlightText`. That backplate sits
   * on top of the `Highlight` fill and hides the glyph (verified against a real minimal page; see
   * design-system-v2 spec §4). `forced-color-adjust: none`, scoped to the pressed state, disables
   * it. `getComputedStyle`'s `background-color`/`color` (above) cannot detect this bug at all — the
   * backplate is a browser paint-time effect, not a CSS property change — so this checks the actual
   * computed `forced-color-adjust` value, and the pixel test below checks the real rendering.
   */
  it("sets forced-color-adjust: none only while pressed, in forced colors", async () => {
    await emulateForcedColors(true);
    const screen = await render(<Toggle aria-label="Bold" />);
    const toggle = screen.getByRole("button", { name: "Bold" }).element() as HTMLElement;
    expect(getComputedStyle(toggle).forcedColorAdjust).toBe("auto");
    await toggle.click();
    expect(getComputedStyle(toggle).forcedColorAdjust).toBe("none");
  });

  it(
    "regression: forced-color-adjust: none keeps the pressed glyph legible — without it, the " +
      "Canvas backplate covers much more of the button in white than the glyph strokes alone do",
    async () => {
      await emulateForcedColors(true);
      const screen = await render(
        <div className="inline-flex gap-2 bg-white p-2">
          <Toggle aria-label="Fixed" defaultPressed>
            Bold
          </Toggle>
          {/* Reproduces the pre-fix bug: forces `forced-color-adjust` back to `auto` despite being
              pressed, via an inline style (which wins over the class regardless of Tailwind's own
              rule order). */}
          <Toggle aria-label="Unfixed" defaultPressed style={{ forcedColorAdjust: "auto" }}>
            Bold
          </Toggle>
        </div>,
      );
      const fixed = screen.getByRole("button", { name: "Fixed" }).element() as HTMLElement;
      const unfixed = screen.getByRole("button", { name: "Unfixed" }).element() as HTMLElement;
      expect(getComputedStyle(fixed).forcedColorAdjust).toBe("none");
      expect(getComputedStyle(unfixed).forcedColorAdjust).toBe("auto");

      const fixedWhite = await whitePixelFraction(fixed);
      const unfixedWhite = await whitePixelFraction(unfixed);
      expect(unfixedWhite).toBeGreaterThan(fixedWhite + 0.15);
    },
  );

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Toggle aria-label="Bold">B</Toggle>
        <Toggle aria-label="Italic" variant="outline" defaultPressed>
          I
        </Toggle>
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

function Formatting({
  multiple = true,
  variant,
  orientation,
}: {
  multiple?: boolean;
  variant?: "ghost" | "outline";
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <ToggleGroup
      aria-label="Text formatting"
      multiple={multiple}
      variant={variant}
      orientation={orientation}
    >
      <ToggleGroupItem value="bold" aria-label="Bold">
        B
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic">
        I
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline">
        U
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

describe("ToggleGroup", () => {
  it("has data-slot and merges className on the group and its items", async () => {
    const screen = await render(<Formatting />);
    const group = screen.getByRole("group", { name: "Text formatting" });
    await expect.element(group).toHaveAttribute("data-slot", "toggle-group");
    await expect
      .element(screen.getByRole("button", { name: "Bold" }))
      .toHaveAttribute("data-slot", "toggle");
  });

  it("allows only one pressed value by default (single)", async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <ToggleGroup aria-label="Alignment" onValueChange={onValueChange}>
        <ToggleGroupItem value="left" aria-label="Left">
          L
        </ToggleGroupItem>
        <ToggleGroupItem value="right" aria-label="Right">
          R
        </ToggleGroupItem>
      </ToggleGroup>,
    );
    const left = screen.getByRole("button", { name: "Left" });
    const right = screen.getByRole("button", { name: "Right" });
    await left.click();
    await expect.element(left).toHaveAttribute("aria-pressed", "true");
    await right.click();
    await expect.element(right).toHaveAttribute("aria-pressed", "true");
    await expect.element(left).toHaveAttribute("aria-pressed", "false");
    expect(onValueChange).toHaveBeenLastCalledWith(["right"], expect.anything());
  });

  it("allows multiple pressed values with multiple", async () => {
    const screen = await render(<Formatting multiple />);
    const bold = screen.getByRole("button", { name: "Bold" });
    const italic = screen.getByRole("button", { name: "Italic" });
    await bold.click();
    await italic.click();
    await expect.element(bold).toHaveAttribute("aria-pressed", "true");
    await expect.element(italic).toHaveAttribute("aria-pressed", "true");
  });

  it("moves focus with the arrow keys as a single Tab stop (roving)", async () => {
    const screen = await render(<Formatting />);
    const bold = screen.getByRole("button", { name: "Bold" }).element();
    const italic = screen.getByRole("button", { name: "Italic" }).element();
    const underline = screen.getByRole("button", { name: "Underline" }).element();
    await userEvent.tab();
    expect(document.activeElement).toBe(bold);
    expect(bold.getAttribute("tabindex")).toBe("0");
    expect(italic.getAttribute("tabindex")).toBe("-1");
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(italic);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(underline);
    // A single Tab stop: Tab leaves the group entirely rather than moving to the next item.
    await userEvent.tab();
    expect(document.activeElement).not.toBe(bold);
    expect(document.activeElement).not.toBe(italic);
    expect(document.activeElement).not.toBe(underline);
  });

  it("moves focus vertically with the arrow keys when orientation is vertical", async () => {
    const screen = await render(<Formatting orientation="vertical" />);
    const bold = screen.getByRole("button", { name: "Bold" }).element() as HTMLElement;
    const italic = screen.getByRole("button", { name: "Italic" }).element();
    bold.focus();
    expect(document.activeElement).toBe(bold);
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(italic);
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(bold);
  });

  it("attaches the outline variant: the middle item has no radius, borders overlap by 1px", async () => {
    const screen = await render(<Formatting variant="outline" />);
    const group = screen.getByRole("group", { name: "Text formatting" }).element();
    const bold = screen.getByRole("button", { name: "Bold" }).element();
    const italic = screen.getByRole("button", { name: "Italic" }).element();
    const underline = screen.getByRole("button", { name: "Underline" }).element();
    expect(getComputedStyle(group).gap).toBe("0px");
    expect(getComputedStyle(italic).borderRadius).toBe("0px");
    expect(getComputedStyle(bold).borderTopLeftRadius).not.toBe("0px");
    expect(getComputedStyle(underline).borderTopRightRadius).not.toBe("0px");
    const boldRect = bold.getBoundingClientRect();
    const italicRect = italic.getBoundingClientRect();
    expect(Math.abs(italicRect.left - boldRect.right)).toBeLessThanOrEqual(1);
  });

  it("raises the focused item above its neighbours with focus-visible:z-10", async () => {
    const screen = await render(<Formatting variant="outline" />);
    const bold = screen.getByRole("button", { name: "Bold" }).element() as HTMLElement;
    await userEvent.tab();
    expect(document.activeElement).toBe(bold);
    expect(getComputedStyle(bold).zIndex).toBe("10");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Formatting />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
