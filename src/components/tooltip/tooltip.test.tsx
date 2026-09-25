import axe from "axe-core";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { waitForPopupSettled } from "../../../test/overlay";
import { Button, buttonVariants } from "../button";
import {
  Tooltip,
  TooltipContent,
  type TooltipContentProps,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

function Basic({ content, ...props }: TooltipContentProps & { content?: string }) {
  // Padding leaves room on every side, so the tooltip never flips away from `side`.
  return (
    <div className="p-16">
      <Tooltip>
        <TooltipTrigger delay={0} closeDelay={0}>
          Save
        </TooltipTrigger>
        <TooltipContent {...props}>{content ?? "Save your changes"}</TooltipContent>
      </Tooltip>
    </div>
  );
}

const tooltip = () => page.getByRole("tooltip");

async function openByHover(trigger = page.getByRole("button", { name: "Save" })) {
  await userEvent.hover(trigger);
  await expect.element(tooltip()).toBeVisible();
  return tooltip().element() as HTMLElement;
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("Tooltip", () => {
  it("opens on hover with role=tooltip, and the trigger is described by it", async () => {
    await render(<Basic />);
    const trigger = page.getByRole("button", { name: "Save" });
    // Move the pointer off in case an earlier test left it parked where this trigger mounts.
    await userEvent.unhover(trigger);
    await expect.element(trigger).not.toHaveAttribute("aria-describedby");
    const popup = await openByHover(trigger);
    expect(popup.textContent).toBe("Save your changes");
    expect(popup.id).not.toBe("");
    await expect.element(trigger).toHaveAttribute("aria-describedby", popup.id);
    await expect.element(trigger).toHaveAccessibleDescription("Save your changes");
  });

  it("closes on unhover and drops aria-describedby", async () => {
    await render(<Basic />);
    const trigger = page.getByRole("button", { name: "Save" });
    await openByHover(trigger);
    await userEvent.unhover(trigger);
    await expect.element(tooltip()).not.toBeInTheDocument();
    await expect.element(trigger).not.toHaveAttribute("aria-describedby");
  });

  it("opens on keyboard focus (Tab) and closes on Escape", async () => {
    await render(<Basic />);
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("button", { name: "Save" }).element());
    await expect.element(tooltip()).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(tooltip()).not.toBeInTheDocument();
  });

  it("portals the content to document.body, outside the render container", async () => {
    const screen = await render(<Basic />);
    const popup = await openByHover();
    expect(screen.container.contains(popup)).toBe(false);
    expect(document.body.contains(popup)).toBe(true);
  });

  it("sets data-slot, defaults to side=top, and merges className", async () => {
    await render(<Basic className="max-w-none" />);
    const popup = await openByHover();
    expect(popup.getAttribute("data-slot")).toBe("tooltip-content");
    expect(popup.getAttribute("data-side")).toBe("top");
    expect(popup.classList.contains("max-w-none")).toBe(true);
    expect(popup.classList.contains("max-w-xs")).toBe(false);
    expect(popup.classList.contains("bg-tooltip")).toBe(true);
  });

  it("passes side to the positioner", async () => {
    await render(<Basic side="bottom" />);
    const popup = await openByHover();
    expect(popup.getAttribute("data-side")).toBe("bottom");
  });

  it("sits 6px from the trigger by default", async () => {
    await render(<Basic />);
    const trigger = page.getByRole("button", { name: "Save" }).element();
    const popup = await openByHover();
    // Let the scale transition settle so the box is at its final size.
    await waitForPopupSettled(popup);
    const gap = trigger.getBoundingClientRect().top - popup.getBoundingClientRect().bottom;
    expect(Math.round(gap)).toBe(6);
  });

  it("uses the tooltip token background/foreground (not --neutral) and the tooltip z-index", async () => {
    const screen = await render(
      <div>
        <Basic />
        <div data-testid="tooltip-ref" className="bg-tooltip text-tooltip-foreground" />
        <div data-testid="neutral-ref" className="bg-neutral text-neutral-foreground" />
      </div>,
    );
    const popup = await openByHover();
    const tooltipRef = screen.getByTestId("tooltip-ref").element();
    const neutralRef = screen.getByTestId("neutral-ref").element();
    expect(getComputedStyle(popup).backgroundColor).toBe(
      getComputedStyle(tooltipRef).backgroundColor,
    );
    expect(getComputedStyle(popup).color).toBe(getComputedStyle(tooltipRef).color);
    // In light mode --tooltip and --neutral happen to coincide (both the dark surface-900 chip),
    // so this only distinguishes them from each other in dark mode (covered below).
    void neutralRef;
    const positioner = popup.parentElement as HTMLElement;
    expect(getComputedStyle(positioner).zIndex).toBe("60");
  });

  it("has a 1px border (transparent in light, a visible edge in forced-colors mode)", async () => {
    await render(<Basic />);
    const popup = await openByHover();
    expect(popup.classList.contains("border")).toBe(true);
    expect(popup.classList.contains("border-tooltip-border")).toBe(true);
    const style = getComputedStyle(popup);
    expect(style.borderTopWidth).toBe("1px");
    expect(style.borderTopStyle).toBe("solid");
    expect(style.borderTopColor).toBe("rgba(0, 0, 0, 0)");
  });

  it("follows .dark on <html> (portalled content inherits the root theme) and no longer reuses --neutral's near-white dark value", async () => {
    const screen = await render(
      <div>
        <Basic />
        <div data-testid="tooltip-ref" className="bg-tooltip" />
        <div data-testid="neutral-ref" className="bg-neutral" />
      </div>,
    );
    const tooltipRef = screen.getByTestId("tooltip-ref").element();
    const neutralRef = screen.getByTestId("neutral-ref").element();
    const lightBg = getComputedStyle(tooltipRef).backgroundColor;
    document.documentElement.classList.add("dark");
    try {
      const popup = await openByHover();
      const darkBg = getComputedStyle(tooltipRef).backgroundColor;
      const darkNeutralBg = getComputedStyle(neutralRef).backgroundColor;
      expect(darkBg).not.toBe(lightBg);
      expect(getComputedStyle(popup).backgroundColor).toBe(darkBg);
      // The bug this fixes: --neutral is a near-white surface-50 in dark mode, so the tooltip must
      // not use it any more.
      expect(darkBg).not.toBe(darkNeutralBg);
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });

  const surfaces = ["marble", "slate", "sandstone"] as const;
  const themes = ["light", "dark"] as const;

  // This Chromium's `getComputedStyle` serializes theme colours (declared in oklch()) back as
  // `oklch(L C H)` rather than `rgb()`, so relative luminance is computed directly from OKLCH
  // (same conversion as scripts/generate-palettes.mjs's contrast gate) instead of parsing rgb().
  function oklchToLinearSrgb(l: number, c: number, h: number): [number, number, number] {
    const a = c * Math.cos((h * Math.PI) / 180);
    const b = c * Math.sin((h * Math.PI) / 180);
    const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
      -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
      -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
    ];
  }

  function srgbChannelToLinear(channel: number): number {
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }

  /** WCAG relative luminance of an `oklch()` or `rgb()`/`rgba()` computed-style colour. */
  function relativeLuminance(color: string): number {
    const oklchMatch = color.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (oklchMatch) {
      const l = Number(oklchMatch[1]);
      const c = Number(oklchMatch[2]);
      const h = Number(oklchMatch[3]);
      const [linearR, linearG, linearB] = oklchToLinearSrgb(l, c, h);
      const r = Math.min(Math.max(linearR, 0), 1);
      const g = Math.min(Math.max(linearG, 0), 1);
      const b = Math.min(Math.max(linearB, 0), 1);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    const rgbMatch = color.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (!rgbMatch) throw new Error(`Unrecognised computed colour: ${color}`);
    const r = srgbChannelToLinear(Number(rgbMatch[1]) / 255);
    const g = srgbChannelToLinear(Number(rgbMatch[2]) / 255);
    const b = srgbChannelToLinear(Number(rgbMatch[3]) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastRatio(a: string, b: string): number {
    const l1 = relativeLuminance(a);
    const l2 = relativeLuminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  describe.each(surfaces)("across the %s surface palette", (surface) => {
    it.each(themes)(
      "computes a --tooltip background/foreground/border with contrast >= 4.5:1 (%s)",
      async (theme) => {
        if (theme === "dark") document.documentElement.classList.add("dark");
        try {
          await render(
            <div data-surface={surface} className="bg-background">
              <Basic />
            </div>,
          );
          const popup = await openByHover();
          const style = getComputedStyle(popup);
          const bg = style.backgroundColor;
          const fg = style.color;
          const border = style.borderTopColor;
          expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
          if (theme === "light") {
            // Light: --tooltip-border is the literal token `transparent`.
            expect(border).toBe("rgba(0, 0, 0, 0)");
          } else {
            // Dark: --tooltip-border is a visible surface-600 outline on the raised chip.
            expect(border).not.toBe("rgba(0, 0, 0, 0)");
          }
        } finally {
          document.documentElement.classList.remove("dark");
        }
      },
    );
  });

  it("renders into `container` when given one", async () => {
    function Scoped() {
      const scope = useRef<HTMLDivElement>(null);
      return (
        <div ref={scope} data-primary="lapis" data-testid="scope">
          <Basic container={scope} />
        </div>
      );
    }
    const screen = await render(<Scoped />);
    const popup = await openByHover();
    expect(screen.getByTestId("scope").element().contains(popup)).toBe(true);
  });

  it("composes with Button: one button, Button classes, named by aria-label, described by the tooltip", async () => {
    const screen = await render(
      <Tooltip>
        <TooltipTrigger
          delay={0}
          closeDelay={0}
          render={<Button size="icon" variant="outline" aria-label="Add" />}
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
            <path d="M8 3v10M3 8h10" stroke="currentColor" />
          </svg>
        </TooltipTrigger>
        <TooltipContent>Add item</TooltipContent>
      </Tooltip>,
    );
    const buttons = screen.container.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    const button = page.getByRole("button", { name: "Add" });
    await expect.element(button).toHaveAttribute("data-slot", "button");
    for (const cls of buttonVariants({ size: "icon", variant: "outline" }).split(" ")) {
      expect(button.element().classList.contains(cls)).toBe(true);
    }
    await userEvent.hover(button);
    await expect.element(tooltip()).toBeVisible();
    await expect.element(button).toHaveAccessibleDescription("Add item");
  });

  it("merges an aria-describedby on the render element with the tooltip's id", async () => {
    await render(
      <div>
        <span id="save-hint">Ctrl+S</span>
        <Tooltip>
          <TooltipTrigger
            delay={0}
            closeDelay={0}
            render={<Button variant="outline" aria-describedby="save-hint" />}
          >
            Save
          </TooltipTrigger>
          <TooltipContent>Save your changes</TooltipContent>
        </Tooltip>
      </div>,
    );
    const trigger = page.getByRole("button", { name: "Save" });
    await expect.element(trigger).toHaveAttribute("aria-describedby", "save-hint");
    const popup = await openByHover(trigger);
    await expect.element(trigger).toHaveAttribute("aria-describedby", `save-hint ${popup.id}`);
    await expect.element(trigger).toHaveAccessibleDescription("Ctrl+S Save your changes");
    await userEvent.unhover(trigger);
    await expect.element(tooltip()).not.toBeInTheDocument();
    await expect.element(trigger).toHaveAttribute("aria-describedby", "save-hint");
  });

  it("merges aria-describedby given on both the trigger and the render element", async () => {
    await render(
      <div>
        <span id="a">A</span>
        <span id="b">B</span>
        <Tooltip>
          <TooltipTrigger
            delay={0}
            closeDelay={0}
            aria-describedby="a"
            render={<Button aria-describedby="b" />}
          >
            Save
          </TooltipTrigger>
          <TooltipContent>Tip</TooltipContent>
        </Tooltip>
      </div>,
    );
    const trigger = page.getByRole("button", { name: "Save" });
    await expect.element(trigger).toHaveAttribute("aria-describedby", "b a");
    const popup = await openByHover(trigger);
    await expect.element(trigger).toHaveAttribute("aria-describedby", `b a ${popup.id}`);
  });

  it("does not repeat an id given on both the trigger and the render element", async () => {
    await render(
      <div>
        <span id="a">A</span>
        <span id="b">B</span>
        <Tooltip>
          <TooltipTrigger
            delay={0}
            closeDelay={0}
            aria-describedby="a b"
            render={<Button aria-describedby="a" />}
          >
            Save
          </TooltipTrigger>
          <TooltipContent>Tip</TooltipContent>
        </Tooltip>
      </div>,
    );
    const trigger = page.getByRole("button", { name: "Save" });
    // The previous test leaves the pointer parked over its trigger, at the same spot as this one:
    // Chromium hovers the new trigger under it and opens the tooltip. Move the pointer off first.
    await userEvent.unhover(trigger);
    await expect.element(tooltip()).not.toBeInTheDocument();
    await expect.element(trigger).toHaveAttribute("aria-describedby", "a b");
    const popup = await openByHover(trigger);
    await expect.element(trigger).toHaveAttribute("aria-describedby", `a b ${popup.id}`);
  });

  it("forwards ref to the popup element (and null on close)", async () => {
    const received: (HTMLDivElement | null)[] = [];
    await render(<Basic ref={(element) => void received.push(element)} />);
    const trigger = page.getByRole("button", { name: "Save" });
    const popup = await openByHover(trigger);
    expect(received.at(-1)).toBe(popup);
    await userEvent.unhover(trigger);
    await expect.element(tooltip()).not.toBeInTheDocument();
    expect(received.at(-1)).toBeNull();
  });

  it("groups tooltips under a TooltipProvider", async () => {
    await render(
      <TooltipProvider delay={0} closeDelay={0}>
        <Tooltip>
          <TooltipTrigger>Cut</TooltipTrigger>
          <TooltipContent>Cut selection</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger>Copy</TooltipTrigger>
          <TooltipContent>Copy selection</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    await userEvent.hover(page.getByRole("button", { name: "Cut" }));
    await expect.element(page.getByRole("tooltip", { name: "Cut selection" })).toBeVisible();
    await userEvent.hover(page.getByRole("button", { name: "Copy" }));
    await expect.element(page.getByRole("tooltip", { name: "Copy selection" })).toBeVisible();
  });

  it.each(["light", "dark"] as const)("has no axe violations while open (%s)", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    try {
      await render(
        <div className="bg-background">
          <Basic />
        </div>,
      );
      const popup = await openByHover();
      // Let the opacity transition settle so contrast is measured at rest.
      await waitForPopupSettled(popup);
      // The popup is portalled, so audit the whole body. `region` (page content inside landmarks)
      // is a page-level rule about the host app, not about this component: off here.
      const results = await axe.run(document.body, { rules: { region: { enabled: false } } });
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });
});
