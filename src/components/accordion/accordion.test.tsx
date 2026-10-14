import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Button } from "../button";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  type AccordionProps,
  AccordionTrigger,
  type AccordionTriggerProps,
} from "./accordion";

function Faq({
  headingLevel,
  disableReturns,
  ...rootProps
}: AccordionProps & {
  headingLevel?: AccordionTriggerProps["headingLevel"];
  disableReturns?: boolean;
}) {
  return (
    <Accordion {...rootProps}>
      <AccordionItem value="shipping">
        <AccordionTrigger headingLevel={headingLevel}>
          How long does shipping take?
        </AccordionTrigger>
        <AccordionPanel>
          Orders ship within two working days and arrive in three to five.
        </AccordionPanel>
      </AccordionItem>
      <AccordionItem value="returns" disabled={disableReturns}>
        <AccordionTrigger headingLevel={headingLevel}>Can I return an item?</AccordionTrigger>
        <AccordionPanel>
          <p id="returns-detail">Yes, within 30 days of delivery, in its original packaging.</p>
        </AccordionPanel>
      </AccordionItem>
      <AccordionItem value="warranty">
        <AccordionTrigger headingLevel={headingLevel}>Is there a warranty?</AccordionTrigger>
        <AccordionPanel>Two years on every product, parts and labour.</AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
}

/** Tabs until `target` has focus; fails after 20 presses instead of looping forever. */
async function tabTo(target: Element) {
  for (let presses = 0; presses < 20; presses++) {
    await userEvent.tab();
    if (document.activeElement === target) return;
  }
  throw new Error(`Tab never reached ${target.outerHTML.slice(0, 80)}`);
}

type Rgb = [number, number, number];

/**
 * Screenshots `element` (real Chromium pixels) and returns the RGB colour at each viewport point.
 */
async function sampleScreenshot(element: Element, points: { x: number; y: number }[]) {
  const base64 = await page.screenshot({ element, save: false });
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  context.drawImage(image, 0, 0);
  const origin = element.getBoundingClientRect();
  const scale = image.naturalWidth / origin.width;
  return points.map(({ x, y }) => {
    const data = context.getImageData(
      Math.floor((x - origin.left) * scale),
      Math.floor((y - origin.top) * scale),
      1,
      1,
    ).data;
    return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0] as Rgb;
  });
}

/** The largest per-channel difference between two sampled colours. */
function colorDistance(a: Rgb | undefined, b: Rgb | undefined) {
  if (!a || !b) throw new Error("missing pixel sample");
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Waits (polling, no fixed sleep) until nothing in the document is animating. */
async function animationsSettled() {
  await nextFrame();
  await expect.poll(() => document.getAnimations().length, { timeout: 2000 }).toBe(0);
}

/** The panel in the trigger's item (Base UI sets `aria-controls` only while it is open). */
const panelOf = (trigger: Element) =>
  trigger
    .closest('[data-slot="accordion-item"]')
    ?.querySelector<HTMLElement>('[data-slot="accordion-panel"]') ?? null;
const chevronOf = (trigger: Element) =>
  trigger.querySelector('[data-slot="accordion-chevron"]') as SVGElement | null;

/**
 * Starts recording the panel's rendered height every frame; the returned function stops and
 * returns the samples. Started before a click, it proves the height moved through intermediate
 * values rather than jumping, however long the click round trip takes.
 */
function recordHeights(getPanel: () => HTMLElement | null) {
  const heights: number[] = [];
  let recording = true;
  const tick = () => {
    if (!recording) return;
    const panel = getPanel();
    heights.push(panel ? panel.getBoundingClientRect().height : 0);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => {
    recording = false;
    return heights;
  };
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("Accordion", () => {
  it("sets data-slot on every part", async () => {
    const screen = await render(<Faq defaultValue={["shipping"]} />);
    const trigger = screen.getByRole("button", { name: "How long does shipping take?" });
    await expect.element(trigger).toHaveAttribute("data-slot", "accordion-trigger");
    const t = trigger.element();
    expect(t.closest('[data-slot="accordion-header"]')).not.toBeNull();
    expect(t.closest('[data-slot="accordion-item"]')).not.toBeNull();
    expect(t.closest('[data-slot="accordion"]')).not.toBeNull();
    expect(chevronOf(t)?.getAttribute("aria-hidden")).toBe("true");
    const panel = panelOf(t);
    expect(panel).not.toBeNull();
    expect(t.getAttribute("aria-controls")).toBe(panel?.id);
    expect(panel?.getAttribute("role")).toBe("region");
    expect(panel?.getAttribute("aria-labelledby")).toBe(t.id);
    expect(panel?.querySelector('[data-slot="accordion-panel-content"]')).not.toBeNull();
  });

  it("toggles aria-expanded with Enter and Space", async () => {
    const screen = await render(<Faq />);
    const trigger = screen.getByRole("button", { name: "How long does shipping take?" });
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger.element());
    await userEvent.keyboard("{Enter}");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    await expect.element(screen.getByText(/Orders ship within two working days/)).toBeVisible();
    await userEvent.keyboard(" ");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard(" ");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Enter}");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the open item when another opens in single mode", async () => {
    const onValueChange = vi.fn();
    const screen = await render(<Faq defaultValue={["shipping"]} onValueChange={onValueChange} />);
    const shipping = screen.getByRole("button", { name: "How long does shipping take?" });
    const warranty = screen.getByRole("button", { name: "Is there a warranty?" });
    await expect.element(shipping).toHaveAttribute("aria-expanded", "true");
    await warranty.click();
    await expect.element(warranty).toHaveAttribute("aria-expanded", "true");
    await expect.element(shipping).toHaveAttribute("aria-expanded", "false");
    expect(onValueChange).toHaveBeenLastCalledWith(["warranty"], expect.anything());
  });

  it("keeps several items open with multiple", async () => {
    const screen = await render(<Faq multiple />);
    const shipping = screen.getByRole("button", { name: "How long does shipping take?" });
    const warranty = screen.getByRole("button", { name: "Is there a warranty?" });
    await shipping.click();
    await warranty.click();
    await expect.element(shipping).toHaveAttribute("aria-expanded", "true");
    await expect.element(warranty).toHaveAttribute("aria-expanded", "true");
  });

  it("renders the trigger inside an h3 by default and honours headingLevel", async () => {
    const screen = await render(
      <div>
        <Faq />
        <Faq headingLevel={2} />
      </div>,
    );
    const h3 = screen.getByRole("heading", { level: 3, name: "Is there a warranty?" });
    await expect.element(h3).toBeInTheDocument();
    expect(h3.element().tagName).toBe("H3");
    const h2 = screen.getByRole("heading", { level: 2, name: "Is there a warranty?" });
    expect(h2.element().tagName).toBe("H2");
    expect(h2.element().getAttribute("data-slot")).toBe("accordion-header");
    expect(h2.element().querySelector("button")?.textContent).toContain("Is there a warranty?");
  });

  it.each([1, 4, 6] as const)("renders an h%i for headingLevel=%i", async (level) => {
    const screen = await render(<Faq headingLevel={level} />);
    const heading = screen.getByRole("heading", { level, name: "Is there a warranty?" });
    expect(heading.element().tagName).toBe(`H${level}`);
  });

  it("animates the panel height to its content height on open and back to 0 on close", async () => {
    const screen = await render(<Faq keepMounted />);
    const trigger = screen.getByRole("button", { name: "How long does shipping take?" });
    const panel = panelOf(trigger.element()) as HTMLElement;
    const content = panel.querySelector('[data-slot="accordion-panel-content"]') as HTMLElement;
    expect(panel.getBoundingClientRect().height).toBe(0);

    let stop = recordHeights(() => panel);
    await trigger.click();
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    // Base UI swaps the measured px for `auto` once the open transition has ended.
    await expect
      .poll(() => panel.style.getPropertyValue("--accordion-panel-height"), { timeout: 2000 })
      .toBe("auto");
    await animationsSettled();
    const opening = stop();
    const full = panel.getBoundingClientRect().height;
    expect(full).toBeGreaterThan(0);
    expect(Math.abs(full - content.getBoundingClientRect().height)).toBeLessThanOrEqual(1);
    expect(Number.parseFloat(getComputedStyle(panel).height)).toBeGreaterThan(0);
    expect(getComputedStyle(panel).transitionProperty).toBe("height");
    // It grew through intermediate heights instead of snapping open.
    expect(opening.some((h) => h > 0.5 && h < full - 0.5)).toBe(true);

    stop = recordHeights(() => panel);
    await trigger.click();
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
    // keepMounted: the panel gets `hidden` once the close transition has ended.
    await expect.poll(() => panel.hasAttribute("hidden"), { timeout: 2000 }).toBe(true);
    await animationsSettled();
    const closing = stop();
    expect(closing.some((h) => h > 0.5 && h < full - 0.5)).toBe(true);
    expect(panel.getBoundingClientRect().height).toBe(0);
  });

  it("rotates the chevron when the item opens", async () => {
    const screen = await render(<Faq />);
    const trigger = screen.getByRole("button", { name: "Is there a warranty?" });
    const chevron = chevronOf(trigger.element()) as SVGElement;
    expect(getComputedStyle(chevron).rotate).toBe("none");
    await trigger.click();
    await animationsSettled();
    expect(getComputedStyle(chevron).rotate).toBe("180deg");
    expect(getComputedStyle(chevron).transitionProperty).toContain("rotate");
    await trigger.click();
    await animationsSettled();
    expect(getComputedStyle(chevron).rotate).toBe("none");
  });

  /*
   * Real media emulation through the Chrome DevTools Protocol (vitest/browser `cdp()`): the
   * `prefers-reduced-motion: reduce` query actually matches, so this checks the cascade, not
   * just the class list.
   */
  describe("under prefers-reduced-motion: reduce", () => {
    const emulate = (value: "reduce" | "") =>
      cdp().send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value }],
      });
    afterEach(async () => {
      await emulate("");
    });

    it("opens and closes the panel and turns the chevron without transitions", async () => {
      await emulate("reduce");
      expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
      const screen = await render(<Faq keepMounted />);
      const trigger = screen.getByRole("button", { name: "How long does shipping take?" });
      const chevron = chevronOf(trigger.element()) as SVGElement;
      expect(getComputedStyle(chevron).transitionProperty).toBe("none");
      await trigger.click();
      await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
      const panel = panelOf(trigger.element()) as HTMLElement;
      // Every state the panel passes through (starting/open/ending) has no transition.
      expect(getComputedStyle(panel).transitionProperty).toBe("none");
      await animationsSettled();
      expect(getComputedStyle(panel).transitionProperty).toBe("none");
      expect(panel.getBoundingClientRect().height).toBeGreaterThan(0);
      expect(getComputedStyle(chevron).rotate).toBe("180deg");
      await trigger.click();
      await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
      expect(getComputedStyle(panel).transitionProperty).toBe("none");
      await animationsSettled();
      expect(panel.getBoundingClientRect().height).toBe(0);
    });
  });

  it("keeps closed panels in the DOM as hidden=until-found with hiddenUntilFound", async () => {
    const screen = await render(<Faq hiddenUntilFound />);
    const returns = screen.getByRole("button", { name: "Can I return an item?" });
    const panel = panelOf(returns.element()) as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute("hidden")).toBe("until-found");
    expect(panel.querySelector("#returns-detail")?.textContent).toContain("within 30 days");
    // What find-in-page does when it matches hidden content: the browser fires `beforematch`.
    panel.dispatchEvent(new Event("beforematch", { bubbles: true }));
    await expect.element(returns).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => panel.hasAttribute("hidden")).toBe(false);
    await expect.element(screen.getByText(/Yes, within 30 days of delivery/)).toBeVisible();
  });

  it("never opens a disabled item and shows it as disabled", async () => {
    const screen = await render(<Faq disableReturns />);
    const returns = screen.getByRole("button", { name: "Can I return an item?" });
    await expect.element(returns).toHaveAttribute("data-disabled");
    await expect.element(returns).toHaveAttribute("aria-disabled", "true");
    await returns.click({ force: true });
    await expect.element(returns).toHaveAttribute("aria-expanded", "false");
    returns.element().focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    await expect.element(returns).toHaveAttribute("aria-expanded", "false");
    const style = getComputedStyle(returns.element());
    expect(style.cursor).toBe("not-allowed");
    expect(style.opacity).toBe("0.5");
  });

  it("shows a pointer cursor on triggers", async () => {
    const screen = await render(<Faq />);
    expect(
      getComputedStyle(screen.getByRole("button", { name: "Is there a warranty?" }).element())
        .cursor,
    ).toBe("pointer");
  });

  it("shows a solid 2px outline on Tab focus of a trigger, none before", async () => {
    const screen = await render(<Faq />);
    const trigger = screen.getByRole("button", { name: "How long does shipping take?" }).element();
    expect(getComputedStyle(trigger).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger);
    const style = getComputedStyle(trigger);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
  });

  it("draws a bottom border under each item", async () => {
    const screen = await render(
      <div>
        <Faq />
        <div data-testid="border" className="border border-border" />
      </div>,
    );
    const item = screen
      .getByRole("button", { name: "Is there a warranty?" })
      .element()
      .closest('[data-slot="accordion-item"]') as HTMLElement;
    const style = getComputedStyle(item);
    expect(style.borderBottomWidth).toBe("1px");
    expect(style.borderTopWidth).toBe("0px");
    expect(style.borderBottomColor).toBe(
      getComputedStyle(screen.getByTestId("border").element()).borderTopColor,
    );
  });

  it("merges className strings and accepts className state functions", async () => {
    const screen = await render(
      <Accordion className="max-w-md" defaultValue={["a"]}>
        <AccordionItem value="a" className="border-b-2">
          <AccordionTrigger className={(s) => (s.open ? "is-open py-2" : "is-closed")}>
            A
          </AccordionTrigger>
          <AccordionPanel className="text-base">Panel A</AccordionPanel>
        </AccordionItem>
      </Accordion>,
    );
    const trigger = screen.getByRole("button", { name: "A" });
    await expect.element(trigger).toHaveClass("is-open");
    await expect.element(trigger).toHaveClass("py-2");
    await expect.element(trigger).not.toHaveClass("py-4");
    const t = trigger.element();
    expect(t.closest('[data-slot="accordion"]')?.classList.contains("max-w-md")).toBe(true);
    const item = t.closest('[data-slot="accordion-item"]') as HTMLElement;
    expect(item.classList.contains("border-b-2")).toBe(true);
    expect(item.classList.contains("border-b")).toBe(false);
    const panel = panelOf(t) as HTMLElement;
    expect(panel.classList.contains("text-base")).toBe(true);
    expect(panel.classList.contains("text-sm")).toBe(false);
  });

  /*
   * The panel clips its content for the height animation. Its clip is widened by 4px on each
   * side (`overflow-clip-margin` + a `clip-path` inset that trims only top and bottom), so a
   * flush-left or flush-right focusable's 2px outline at a 2px offset stays fully visible. Checked
   * on real pixels: a screenshot of the region must show the ring colour at the outer edge of the
   * outline, outside the panel's box.
   */
  it("keeps the focus ring of flush-left and flush-right content visible", async () => {
    const screen = await render(
      <div data-testid="frame" className="bg-background p-8">
        <div data-testid="ring-swatch" className="mb-4 size-4 bg-ring" />
        <Accordion defaultValue={["email"]}>
          <AccordionItem value="email">
            <AccordionTrigger>Email</AccordionTrigger>
            <AccordionPanel>
              <div className="flex justify-between">
                <Button variant="outline">Left</Button>
                <Button variant="outline">Right</Button>
              </div>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </div>,
    );
    await animationsSettled();
    const trigger = screen.getByRole("button", { name: "Email" }).element();
    const panelBox = (panelOf(trigger) as HTMLElement).getBoundingClientRect();
    const frame = screen.getByTestId("frame");
    const swatch = screen.getByTestId("ring-swatch").element().getBoundingClientRect();
    for (const [name, side] of [
      ["Left", "left"],
      ["Right", "right"],
    ] as const) {
      const button = screen.getByRole("button", { name }).element() as HTMLElement;
      await tabTo(button);
      const style = getComputedStyle(button);
      expect(style.outlineStyle).toBe("solid");
      const reach = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
      expect(reach).toBe(4);
      const box = button.getBoundingClientRect();
      // Flush with the panel edge, so the ring lies outside the panel's box.
      expect(Math.round(box[side])).toBe(Math.round(panelBox[side]));
      await nextFrame();
      const pixels = await sampleScreenshot(frame.element(), [
        // The middle of the 2px outline (its inner pixel column, 1px in from the outer edge — clear
        // of antialiasing at any DPR), at the button's vertical middle. Still outside the panel.
        {
          x: side === "left" ? box.left - reach + 1.5 : box.right + reach - 1.5,
          y: box.top + box.height / 2,
        },
        { x: swatch.left + swatch.width / 2, y: swatch.top + swatch.height / 2 },
      ]);
      expect(colorDistance(pixels[0], pixels[1])).toBeLessThan(12);
    }
    // Content still aligns with the trigger's edges.
    const triggerBox = trigger.getBoundingClientRect();
    const left = screen.getByRole("button", { name: "Left" }).element().getBoundingClientRect();
    const right = screen.getByRole("button", { name: "Right" }).element().getBoundingClientRect();
    expect(Math.round(left.left)).toBe(Math.round(triggerBox.left));
    expect(Math.round(right.right)).toBe(Math.round(triggerBox.right));
  });

  /*
   * The widened clip is horizontal only: mid-animation (here a panel pinned at 12px tall) nothing
   * of the content may paint below the panel's bottom edge, or a collapsing panel would leave a
   * 4px sliver under the trigger.
   */
  it("clips content exactly at the panel's bottom edge", async () => {
    const screen = await render(
      <div data-testid="frame" className="bg-background p-8">
        <Accordion defaultValue={["email"]}>
          <AccordionItem value="email" className="border-b-0">
            <AccordionTrigger>Email</AccordionTrigger>
            <AccordionPanel className="h-3">
              <div className="h-20 bg-danger" />
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </div>,
    );
    await animationsSettled();
    const panel = panelOf(screen.getByRole("button", { name: "Email" }).element()) as HTMLElement;
    const box = panel.getBoundingClientRect();
    expect(box.height).toBe(12);
    const x = box.left + box.width / 2;
    const [inside, below, background] = await sampleScreenshot(
      screen.getByTestId("frame").element(),
      [
        { x, y: box.bottom - 2 },
        { x, y: box.bottom + 2 },
        { x, y: box.bottom + 12 },
      ],
    );
    expect(colorDistance(inside, background)).toBeGreaterThan(40);
    expect(colorDistance(below, background)).toBeLessThan(12);
  });

  /*
   * The ring room must not widen the panel: inside a scroll parent with no padding, an open
   * panel may not add horizontal overflow (a negative-margin approach made it 8px wider).
   */
  it("adds no horizontal overflow inside a zero-padding scroll parent", async () => {
    const screen = await render(
      <div data-testid="scroller" className="w-80 overflow-auto">
        <Accordion defaultValue={["email"]}>
          <AccordionItem value="email">
            <AccordionTrigger>Email</AccordionTrigger>
            <AccordionPanel>
              <div className="flex justify-between">
                <Button variant="outline">Left</Button>
                <Button variant="outline">Right</Button>
              </div>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </div>,
    );
    await animationsSettled();
    const scroller = screen.getByTestId("scroller").element();
    const panel = panelOf(screen.getByRole("button", { name: "Email" }).element()) as HTMLElement;
    expect(scroller.scrollWidth).toBe(scroller.clientWidth);
    expect(panel.getBoundingClientRect().width).toBe(
      (panel.closest('[data-slot="accordion-item"]') as HTMLElement).getBoundingClientRect().width,
    );
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    try {
      const screen = await render(
        <div className="flex flex-col gap-8 bg-background p-4 text-foreground">
          <Faq multiple hiddenUntilFound defaultValue={["shipping", "warranty"]} disableReturns />
          <Accordion defaultValue={["email"]}>
            <AccordionItem value="email">
              <AccordionTrigger headingLevel={2}>Email</AccordionTrigger>
              <AccordionPanel>Weekly digest and security alerts.</AccordionPanel>
            </AccordionItem>
            <AccordionItem value="push" disabled>
              <AccordionTrigger headingLevel={2}>Push</AccordionTrigger>
              <AccordionPanel>Mentions and replies.</AccordionPanel>
            </AccordionItem>
          </Accordion>
        </div>,
      );
      await animationsSettled();
      const results = await axe.run(screen.container);
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });
});

describe("Accordion RTL", () => {
  it.each(["ltr", "rtl"] as const)(
    "%s: the trigger text aligns to the inline start",
    async (dir) => {
      const screen = await render(
        <div dir={dir}>
          <Faq />
        </div>,
      );
      const trigger = screen.container.querySelector(
        '[data-slot="accordion-trigger"]',
      ) as HTMLElement;
      expect(getComputedStyle(trigger).textAlign).toBe("start");
    },
  );
});
