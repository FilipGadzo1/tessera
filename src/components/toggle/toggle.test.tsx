import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, resetEmulatedMedia, systemColor } from "../../../test/emulation";
import { Toggle, ToggleGroup, ToggleGroupItem } from "./toggle";

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
