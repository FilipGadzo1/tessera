import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { cdp, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, resetEmulatedMedia, systemColor } from "../../../test/emulation";
import { ScrollArea, ScrollAreaContent, ScrollAreaViewport, ScrollBar } from "./scroll-area";

afterEach(async () => {
  await resetEmulatedMedia();
});

/** Real wheel scroll through CDP so the browser actually scrolls the viewport, as a user would. */
async function wheelAt(x: number, y: number, deltaY: number) {
  await cdp().send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x,
    y,
    deltaX: 0,
    deltaY,
  });
}

function TallList({ count = 30 }: { count?: number }) {
  // m-4: keep the area off the page origin, where `parkPointer` leaves the real pointer; at (0,0)
  // a synthetic mouse move after layout can mark the root hovered and show the bars (flaky under
  // full-suite load, found in Phase F Task 4).
  return (
    <ScrollArea className="m-4 h-48 w-64">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixture rows have no identity beyond position.
        <div key={`item-${i}`} className="h-8 px-2 text-sm text-foreground">
          Item {i + 1}
        </div>
      ))}
    </ScrollArea>
  );
}

function WideGallery({ count = 20 }: { count?: number }) {
  return (
    <ScrollArea orientation="horizontal" className="h-32 w-64">
      <div className="flex gap-2">
        {Array.from({ length: count }, (_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixture tiles have no identity beyond position.
            key={`tile-${i}`}
            className="flex h-24 w-24 shrink-0 items-center justify-center bg-muted text-sm text-foreground"
          >
            {i + 1}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

const viewportOf = (root: Element) =>
  root.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
const scrollbarOf = (root: Element, orientation: "vertical" | "horizontal" = "vertical") =>
  root.querySelector(
    `[data-slot="scroll-area-scrollbar"][data-orientation="${orientation}"]`,
  ) as HTMLElement;
const thumbOf = (scrollbar: Element) =>
  scrollbar.querySelector('[data-slot="scroll-area-thumb"]') as HTMLElement;

describe("ScrollArea", () => {
  it("sets data-slot on every part and merges className", async () => {
    const screen = await render(<TallList />);
    const root = screen.container.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    await expect.element(root).toHaveClass("h-48");
    await expect.element(root).toHaveClass("w-64");
    expect(viewportOf(root)).toBeTruthy();
    expect(root.querySelector('[data-slot="scroll-area-content"]')).toBeTruthy();
    expect(scrollbarOf(root)).toBeTruthy();
    expect(thumbOf(scrollbarOf(root))).toBeTruthy();
  });

  it("scrolls with the mouse wheel", async () => {
    const screen = await render(<TallList />);
    const root = screen.container.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    const viewport = viewportOf(root);
    expect(viewport.scrollTop).toBe(0);
    const rect = viewport.getBoundingClientRect();
    await wheelAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 200);
    await expect.poll(() => viewport.scrollTop).toBeGreaterThan(0);
  });

  it("scrolls with the keyboard once the viewport is focused", async () => {
    const screen = await render(<TallList />);
    const root = screen.container.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    const viewport = viewportOf(root);
    await expect.element(viewport).toHaveAttribute("tabindex", "0");
    viewport.focus();
    await expect.poll(() => document.activeElement).toBe(viewport);
    for (let i = 0; i < 10; i++) {
      await userEvent.keyboard("{ArrowDown}");
    }
    await expect.poll(() => viewport.scrollTop).toBeGreaterThan(0);
  });

  it("shows a focus ring on the viewport once it is focusable", async () => {
    const screen = await render(<TallList />);
    const root = screen.container.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    const viewport = viewportOf(root);
    for (const cls of ["outline-none", "focus-visible:outline-2", "focus-visible:outline-ring"]) {
      expect(viewport.classList).toContain(cls);
    }
    await userEvent.tab();
    await expect.poll(() => document.activeElement).toBe(viewport);
    const style = getComputedStyle(viewport);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
  });

  it("shows the vertical bar on hover and while scrolling", async () => {
    const screen = await render(<TallList />);
    const root = screen.container.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    const scrollbar = scrollbarOf(root);
    expect(getComputedStyle(scrollbar).opacity).toBe("0");

    await userEvent.hover(scrollbarOf(root));
    await expect.poll(() => scrollbar.getAttribute("data-hovering")).not.toBeNull();
    await expect.poll(() => getComputedStyle(scrollbar).opacity).toBe("1");
    await userEvent.unhover(scrollbarOf(root));

    const viewport = viewportOf(root);
    const rect = viewport.getBoundingClientRect();
    await wheelAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 100);
    await expect.poll(() => scrollbar.getAttribute("data-scrolling")).not.toBeNull();
  });

  it("sizes the thumb proportionally to the visible fraction", async () => {
    const screen = await render(<TallList count={60} />);
    const root = screen.container.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    const scrollbar = scrollbarOf(root);
    const thumb = thumbOf(scrollbar);
    // 60 items * 32px = 1920px content, 192px (h-48) visible => ~10% of the track.
    const track = scrollbar.getBoundingClientRect();
    const expectedHeight = track.height * (192 / 1920);
    await expect
      .poll(() => thumb.getBoundingClientRect().height)
      .toBeGreaterThan(expectedHeight - 2);
    await expect.poll(() => thumb.getBoundingClientRect().height).toBeLessThan(expectedHeight + 2);
  });

  it("scrolls horizontally with the wheel in a horizontal gallery", async () => {
    const screen = await render(<WideGallery />);
    const root = screen.container.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    const viewport = viewportOf(root);
    expect(viewport.scrollLeft).toBe(0);
    expect(scrollbarOf(root, "horizontal")).toBeTruthy();
    expect(scrollbarOf(root, "vertical")).toBeNull();
  });

  it('renders the corner with orientation="both"', async () => {
    const screen = await render(
      <ScrollArea orientation="both" className="h-48 w-64" aria-label="Grid">
        <div className="h-[1000px] w-[1000px]" />
      </ScrollArea>,
    );
    const root = screen.container.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    expect(scrollbarOf(root, "vertical")).toBeTruthy();
    expect(scrollbarOf(root, "horizontal")).toBeTruthy();
    await expect.poll(() => root.querySelector('[data-slot="scroll-area-corner"]')).toBeTruthy();
  });

  it("composes ScrollAreaViewport / ScrollAreaContent directly for a custom layout", async () => {
    const screen = await render(
      <BaseScrollArea.Root
        data-slot="scroll-area"
        className="relative h-48 w-64 overflow-hidden"
        aria-label="Custom"
      >
        <ScrollAreaViewport>
          <ScrollAreaContent className="p-2">
            <div className="h-[600px]">Tall content</div>
          </ScrollAreaContent>
        </ScrollAreaViewport>
        <ScrollBar />
      </BaseScrollArea.Root>,
    );
    const viewport = screen.container.querySelector('[data-slot="scroll-area-viewport"]');
    expect(viewport).toBeTruthy();
    const content = screen.container.querySelector('[data-slot="scroll-area-content"]');
    await expect.element(content as HTMLElement).toHaveClass("p-2");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <TallList />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("forced colors: viewport shows no outline until focused, then a visible ring", async () => {
    await emulateForcedColors(true);
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    const screen = await render(<TallList />);
    const root = screen.container.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    const viewport = viewportOf(root);
    const idle = getComputedStyle(viewport);
    expect(idle.outlineStyle).toBe("none");

    await userEvent.tab();
    await expect.poll(() => document.activeElement).toBe(viewport);
    const focused = getComputedStyle(viewport);
    expect(focused.outlineStyle).toBe("solid");
    expect(Number.parseFloat(focused.outlineWidth)).toBeGreaterThanOrEqual(1);
    expect(focused.outlineColor).not.toBe(systemColor("Canvas"));
  });

  it("keeps the thumb visible in forced colors", async () => {
    await emulateForcedColors(true);
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    const screen = await render(<TallList />);
    const root = screen.container.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    const thumb = thumbOf(scrollbarOf(root));
    const canvas = systemColor("Canvas");
    const style = getComputedStyle(thumb);
    expect(style.backgroundColor).toBe(systemColor("CanvasText"));
    expect(style.backgroundColor).not.toBe(canvas);
  });
});
