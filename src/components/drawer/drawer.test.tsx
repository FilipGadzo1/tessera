import { type ReactElement, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  emulateForcedColors,
  emulateReducedMotion,
  resetEmulatedMedia,
} from "../../../test/emulation";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { Button } from "../button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "../dialog";
import { Input } from "../input";
import { Label } from "../label";
import { Slider } from "../slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  type DrawerContentProps,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  type DrawerProps,
  type DrawerSide,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer";
import * as stories from "./drawer.stories";
import { drawerDefaults, drawerVariants } from "./drawer-variants";

function Basic({
  side,
  onOpenChange,
  children,
  ...props
}: DrawerContentProps & Pick<DrawerProps, "side" | "onOpenChange">) {
  return (
    <Drawer side={side} onOpenChange={onOpenChange}>
      <DrawerTrigger render={<Button variant="outline" />}>Edit profile</DrawerTrigger>
      <DrawerContent {...props}>
        <DrawerHeader>
          <DrawerTitle>Edit profile</DrawerTitle>
          <DrawerDescription>Update your display name.</DrawerDescription>
        </DrawerHeader>
        {children}
      </DrawerContent>
    </Drawer>
  );
}

function WithForm(props: DrawerContentProps & Pick<DrawerProps, "side">) {
  return (
    <Basic {...props}>
      <div className="grid gap-1.5 px-4">
        <Label htmlFor="drawer-name">Name</Label>
        <Input id="drawer-name" defaultValue="Ada" />
      </div>
      <DrawerFooter>
        <DrawerClose render={<Button variant="outline" color="neutral" />}>Cancel</DrawerClose>
        <Button>Save</Button>
      </DrawerFooter>
    </Basic>
  );
}

const drawer = () => page.getByRole("dialog", { name: "Edit profile" });
const trigger = () => page.getByRole("button", { name: "Edit profile" });
const backdrop = () => document.querySelector<HTMLElement>("[data-slot=drawer-backdrop]");

async function openByClick() {
  await userEvent.click(trigger());
  await expect.element(drawer()).toBeVisible();
  const popup = drawer().element() as HTMLElement;
  await waitForPopupSettled(popup);
  return popup;
}

/**
 * Parks the real pointer at the top-left corner through CDP. `userEvent.hover(document.body)`
 * cannot be used here: when a test leaves a drawer (and its full-screen backdrop) open, Playwright's
 * actionability check sees the backdrop intercepting the pointer and times out.
 */
async function parkPointer() {
  await cdp().send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 0, y: 0 });
}

afterEach(async () => {
  document.documentElement.classList.remove("dark");
  await resetEmulatedMedia();
  await parkPointer();
});

describe("Drawer", () => {
  it("opens on click as a modal role=dialog, named and described; focus moves inside", async () => {
    const screen = await render(<Basic />);
    await expect.element(drawer()).not.toBeInTheDocument();
    const triggerElement = trigger().element();
    const popup = await openByClick();
    await expect.element(drawer()).toHaveAccessibleName("Edit profile");
    await expect.element(drawer()).toHaveAccessibleDescription("Update your display name.");
    const title = popup.querySelector("[data-slot=drawer-title]") as HTMLElement;
    const description = popup.querySelector("[data-slot=drawer-description]") as HTMLElement;
    expect(popup.getAttribute("aria-labelledby")).toBe(title.id);
    expect(popup.getAttribute("aria-describedby")).toBe(description.id);
    expect(popup.getAttribute("aria-modal")).toBe("true");
    expect(triggerElement.getAttribute("aria-expanded")).toBe("true");
    // Base UI's DrawerPopup focuses the popup itself by default (`initialFocus` → popupRef).
    await expect.poll(() => popup.contains(document.activeElement)).toBe(true);
    await expect.poll(() => screen.container.getAttribute("aria-hidden")).toBe("true");
  });

  it("omits aria-modal when modal={false}", async () => {
    await render(
      <Drawer modal={false}>
        <DrawerTrigger>Edit profile</DrawerTrigger>
        <DrawerContent>
          <DrawerTitle>Edit profile</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );
    const popup = await openByClick();
    expect(popup.hasAttribute("aria-modal")).toBe(false);
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const onOpenChange = vi.fn();
    await render(<Basic onOpenChange={onOpenChange} />);
    await openByClick();
    await userEvent.keyboard("{Escape}");
    await expect.element(drawer()).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "escape-key" }),
    );
    await expect.poll(() => document.activeElement).toBe(trigger().element());
  });

  it("opens with Enter on the focused trigger", async () => {
    await render(<Basic />);
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger().element());
    await userEvent.keyboard("{Enter}");
    await expect.element(drawer()).toBeVisible();
  });

  it("traps focus: Tab cycles through the drawer's controls", async () => {
    await render(<WithForm />);
    const popup = await openByClick();
    const input = page.getByRole("textbox", { name: "Name" }).element();
    // Focus starts on the popup; Tab walks Name → Cancel → Save → Close and wraps to Name.
    await userEvent.tab();
    expect(document.activeElement).toBe(input);
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("button", { name: "Cancel" }).element());
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("button", { name: "Save" }).element());
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("button", { name: "Close" }).element());
    await userEvent.tab();
    expect(document.activeElement).toBe(input);
    expect(popup.contains(document.activeElement)).toBe(true);
  });

  it("closes on a backdrop click", async () => {
    const onOpenChange = vi.fn();
    await render(<Basic onOpenChange={onOpenChange} />);
    await openByClick();
    // Top-left corner: backdrop, well away from the right-hand drawer.
    await userEvent.click(backdrop() as HTMLElement, { position: { x: 5, y: 5 } });
    await expect.element(drawer()).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "outside-press" }),
    );
  });

  it("closes from the built-in close button, named Close", async () => {
    await render(<Basic />);
    const popup = await openByClick();
    const close = page.getByRole("button", { name: "Close" });
    const slot = popup.querySelector("[data-slot=drawer-close-button]") as HTMLElement;
    expect(slot.contains(close.element())).toBe(true);
    expect(slot.className).toBe("absolute right-4 top-4");
    await expect.element(close).toHaveAttribute("data-slot", "button");
    await expect.element(close).toHaveAttribute("data-variant", "ghost");
    await expect.element(close).toHaveAttribute("data-color", "neutral");
    await expect.element(close).toHaveAttribute("data-size", "icon-sm");
    expect(close.element().querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    await userEvent.click(close);
    await expect.element(drawer()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(trigger().element());
  });

  it("keeps a wrapping header clear of the close button", async () => {
    await render(
      <Drawer>
        <DrawerTrigger>Edit profile</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit profile</DrawerTitle>
            <DrawerDescription>
              Change how you appear to your team, then save when you are done editing.
            </DrawerDescription>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>,
    );
    const popup = await openByClick();
    const close = page.getByRole("button", { name: "Close" }).element().getBoundingClientRect();
    for (const slot of ["drawer-title", "drawer-description"]) {
      const text = (
        popup.querySelector(`[data-slot=${slot}]`) as HTMLElement
      ).getBoundingClientRect();
      const overlaps =
        text.left < close.right &&
        close.left < text.right &&
        text.top < close.bottom &&
        close.top < text.bottom;
      expect(overlaps, slot).toBe(false);
    }
  });

  it("scrolls tall content inside the popup: the last control can be reached and is visible", async () => {
    await render(
      <Basic>
        <div data-testid="tall" className="h-[3000px] shrink-0 px-4">
          Terms
        </div>
        <DrawerFooter>
          <Button>Accept terms</Button>
        </DrawerFooter>
      </Basic>,
    );
    const popup = await openByClick();
    expect(getComputedStyle(popup).overflowY).toBe("auto");
    expect(getComputedStyle(popup).overscrollBehaviorY).toBe("contain");
    expect(popup.scrollHeight).toBeGreaterThan(popup.clientHeight);
    const accept = page.getByRole("button", { name: "Accept terms" });
    // Popup → Accept terms (Tab scrolls it into view inside the popup).
    await userEvent.tab();
    expect(document.activeElement).toBe(accept.element());
    await expect.poll(() => popup.scrollTop).toBeGreaterThan(0);
    const rect = accept.element().getBoundingClientRect();
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    expect(hit !== null && accept.element().contains(hit)).toBe(true);
    // Like Dialog's, the corner close button scrolls with the content (README); Escape still closes.
    const close = page.getByRole("button", { name: "Close" }).element().getBoundingClientRect();
    expect(close.bottom).toBeLessThan(0);
    await userEvent.keyboard("{Escape}");
    await expect.element(drawer()).not.toBeInTheDocument();
  });

  it("closes from DrawerClose", async () => {
    await render(<WithForm />);
    await openByClick();
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.element(drawer()).not.toBeInTheDocument();
  });

  it("omits the close button with showCloseButton={false}", async () => {
    await render(<Basic showCloseButton={false} />);
    const popup = await openByClick();
    expect(popup.querySelector("[data-slot=drawer-close-button]")).toBeNull();
    await expect.element(page.getByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  describe("sides", () => {
    it("defaults to the right side", async () => {
      expect(drawerDefaults.side).toBe("right");
      await render(<Basic />);
      const popup = await openByClick();
      expect(popup.getAttribute("data-side")).toBe("right");
      expect(popup.getAttribute("data-swipe-direction")).toBe("right");
    });

    it.each([
      ["right", "right"],
      ["left", "left"],
      ["bottom", "down"],
      ["top", "up"],
    ] as const)("side=%s sits against its edge and swipes %s to dismiss", async (side, swipe) => {
      await render(<Basic side={side} />);
      const popup = await openByClick();
      expect(popup.getAttribute("data-side")).toBe(side);
      expect(popup.getAttribute("data-swipe-direction")).toBe(swipe);
      const rect = popup.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      if (side === "right" || side === "left") {
        expect(Math.round(rect.top)).toBe(0);
        expect(Math.round(rect.height)).toBe(height);
        // w-3/4 capped at max-w-sm (24rem).
        expect(Math.round(rect.width)).toBe(Math.round(Math.min(width * 0.75, 384)));
        if (side === "right") expect(Math.round(rect.right)).toBe(width);
        else expect(Math.round(rect.left)).toBe(0);
      } else {
        expect(Math.round(rect.left)).toBe(0);
        expect(Math.round(rect.width)).toBe(width);
        expect(rect.height).toBeLessThanOrEqual(height * 0.85 + 1);
        if (side === "bottom") expect(Math.round(rect.bottom)).toBe(height);
        else expect(Math.round(rect.top)).toBe(0);
      }
      const borderSide = { right: "Left", left: "Right", bottom: "Top", top: "Bottom" }[side];
      const style = getComputedStyle(popup);
      expect(style.getPropertyValue(`border-${borderSide.toLowerCase()}-width`)).toBe("1px");
    });

    it("shows an aria-hidden grab handle on bottom drawers only", async () => {
      const screen = await render(<Basic side="bottom" />);
      const popup = await openByClick();
      const handle = popup.querySelector("[data-slot=drawer-handle]") as HTMLElement;
      expect(handle.getAttribute("aria-hidden")).toBe("true");
      expect(handle.className).toBe("mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-muted");
      expect(popup.firstElementChild).toBe(handle);
      await userEvent.keyboard("{Escape}");
      await expect.element(drawer()).not.toBeInTheDocument();
      for (const side of ["right", "left", "top"] as const) {
        await screen.rerender(<Basic side={side} />);
        const other = await openByClick();
        expect(other.querySelector("[data-slot=drawer-handle]")).toBeNull();
        await userEvent.keyboard("{Escape}");
        await expect.element(drawer()).not.toBeInTheDocument();
      }
    });
  });

  it("sets data-slots and part classes, and merges className", async () => {
    await render(<WithForm className="gap-6" />);
    const popup = await openByClick();
    expect(popup.getAttribute("data-slot")).toBe("drawer-content");
    expect(popup.classList.contains("gap-6")).toBe(true);
    expect(popup.classList.contains("gap-4")).toBe(false);
    const part = (slot: string) => document.querySelector(`[data-slot=${slot}]`) as HTMLElement;
    expect(part("drawer-viewport").contains(popup)).toBe(true);
    // Children sit in Base UI's Drawer.Content (mouse swipes ignore it), laid out as popup items.
    expect(part("drawer-body").hasAttribute("data-drawer-content")).toBe(true);
    expect(part("drawer-body").className).toBe("contents");
    expect(getComputedStyle(part("drawer-body")).display).toBe("contents");
    expect(part("drawer-body").contains(part("drawer-header"))).toBe(true);
    expect(part("drawer-body").contains(part("drawer-close-button"))).toBe(false);
    expect(part("drawer-header").className).toBe("flex flex-col gap-1.5 p-4 pr-12");
    expect(part("drawer-footer").className).toBe(
      "mt-auto flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end",
    );
    expect(part("drawer-title").tagName).toBe("H2");
    expect(part("drawer-title").className).toBe("text-lg font-semibold leading-snug");
    expect(part("drawer-description").className).toBe("text-sm text-muted-foreground");
    expect(backdrop()?.className).toContain("fixed inset-0 z-(--z-overlay) bg-black/50");
  });

  it("drawerVariants returns the popup classes per side and merges className", () => {
    const classes = drawerVariants({ side: "bottom", className: "max-h-[50vh]" }).split(" ");
    for (const cls of [
      "fixed",
      "z-(--z-overlay)",
      "flex",
      "flex-col",
      "gap-4",
      "bg-popover",
      "text-popover-foreground",
      "shadow-xl",
      "outline-hidden",
      "overflow-y-auto",
      "overscroll-contain",
      "inset-x-0",
      "bottom-0",
      "rounded-t-xl",
      "border-t",
      "data-starting-style:translate-y-full",
      "data-ending-style:translate-y-full",
      "duration-300",
      "motion-reduce:transition-none",
      "data-swiping:transition-none",
      "max-h-[50vh]",
    ]) {
      expect(classes).toContain(cls);
    }
    expect(classes).not.toContain("max-h-[85vh]");
    expect(drawerVariants().split(" ")).toContain("border-l");
  });

  it("portals the backdrop and popup to document.body", async () => {
    const screen = await render(<Basic />);
    const popup = await openByClick();
    expect(screen.container.contains(popup)).toBe(false);
    expect(document.body.contains(popup)).toBe(true);
    expect(screen.container.contains(backdrop())).toBe(false);
  });

  it("puts the backdrop and popup on the overlay z-index (50) and the popover surface", async () => {
    const screen = await render(
      <div>
        <Basic />
        <div
          data-testid="ref"
          className="border border-border bg-popover text-popover-foreground"
        />
      </div>,
    );
    const popup = await openByClick();
    expect(getComputedStyle(popup).zIndex).toBe("50");
    // The edge border uses the border token, not currentColor.
    expect(getComputedStyle(popup).borderLeftColor).toBe(
      getComputedStyle(screen.getByTestId("ref").element()).borderLeftColor,
    );
    expect(getComputedStyle(backdrop() as HTMLElement).zIndex).toBe("50");
    const reference = screen.getByTestId("ref").element();
    expect(getComputedStyle(popup).backgroundColor).toBe(
      getComputedStyle(reference).backgroundColor,
    );
    expect(getComputedStyle(popup).color).toBe(getComputedStyle(reference).color);
  });

  it("follows .dark on <html>: the popup background is the dark --popover", async () => {
    const screen = await render(
      <div>
        <Basic />
        <div data-testid="ref" className="bg-popover" />
      </div>,
    );
    const reference = screen.getByTestId("ref").element();
    const lightBg = getComputedStyle(reference).backgroundColor;
    document.documentElement.classList.add("dark");
    const popup = await openByClick();
    const darkBg = getComputedStyle(reference).backgroundColor;
    expect(darkBg).not.toBe(lightBg);
    expect(getComputedStyle(popup).backgroundColor).toBe(darkBg);
  });

  it("inherits a nested theme scope through `container`", async () => {
    function Scoped() {
      const scope = useRef<HTMLDivElement>(null);
      return (
        <div ref={scope} data-primary="lapis" data-testid="scope">
          <Basic container={scope}>
            <span data-testid="swatch" className="block size-4 bg-primary" />
          </Basic>
        </div>
      );
    }
    const screen = await render(
      <div>
        <Scoped />
        <div data-primary="lapis">
          <div data-testid="lapis-ref" className="bg-primary" />
        </div>
      </div>,
    );
    const popup = await openByClick();
    expect(screen.getByTestId("scope").element().contains(popup)).toBe(true);
    const lapis = getComputedStyle(screen.getByTestId("lapis-ref").element()).backgroundColor;
    expect(getComputedStyle(page.getByTestId("swatch").element()).backgroundColor).toBe(lapis);
  });

  it("supports controlled open state", async () => {
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <span data-testid="state">{open ? "open" : "closed"}</span>
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger>Edit profile</DrawerTrigger>
            <DrawerContent>
              <DrawerTitle>Edit profile</DrawerTitle>
            </DrawerContent>
          </Drawer>
        </div>
      );
    }
    const screen = await render(<Controlled />);
    await openByClick();
    await expect.element(screen.getByTestId("state")).toHaveTextContent("open");
    await userEvent.keyboard("{Escape}");
    await expect.element(drawer()).not.toBeInTheDocument();
    await expect.element(screen.getByTestId("state")).toHaveTextContent("closed");
  });

  describe("layered Escape", () => {
    it("with a tooltip inside: the first Escape closes only the tooltip, the second the drawer", async () => {
      const onOpenChange = vi.fn();
      await render(
        <Basic onOpenChange={onOpenChange}>
          <div className="px-4">
            <Tooltip>
              <TooltipTrigger delay={0} closeDelay={0} render={<Button variant="outline" />}>
                Help
              </TooltipTrigger>
              <TooltipContent>Opens the help centre</TooltipContent>
            </Tooltip>
          </div>
        </Basic>,
      );
      await openByClick();
      await userEvent.hover(page.getByRole("button", { name: "Help" }));
      await expect.element(page.getByRole("tooltip")).toBeVisible();
      await waitForPopupSettled(
        document.querySelector("[data-slot=tooltip-content]") as HTMLElement,
      );

      await userEvent.keyboard("{Escape}");
      await expect.poll(() => document.querySelector("[data-slot=tooltip-content]")).toBeNull();
      await expect.element(drawer()).toBeVisible();
      expect(onOpenChange.mock.calls.filter(([open]) => open === false)).toHaveLength(0);

      await userEvent.keyboard("{Escape}");
      await expect.element(drawer()).not.toBeInTheDocument();
      expect(onOpenChange).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ reason: "escape-key" }),
      );
    });

    it("with a Dialog opened inside: the first Escape closes only the dialog, the second the drawer", async () => {
      await render(
        <Basic>
          <div className="px-4">
            <Dialog>
              <DialogTrigger render={<Button variant="outline" />}>Delete account</DialogTrigger>
              <DialogContent>
                <DialogTitle>Delete account?</DialogTitle>
                <DialogDescription>This cannot be undone.</DialogDescription>
              </DialogContent>
            </Dialog>
          </div>
        </Basic>,
      );
      await openByClick();
      const dialogTrigger = page.getByRole("button", { name: "Delete account" });
      await userEvent.click(dialogTrigger);
      const dialog = page.getByRole("dialog", { name: "Delete account?" });
      await expect.element(dialog).toBeVisible();
      const dialogPopup = dialog.element() as HTMLElement;
      await waitForPopupSettled(dialogPopup);
      // The dialog stacks above the drawer.
      const rect = dialogPopup.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      expect(hit !== null && dialogPopup.contains(hit)).toBe(true);

      await userEvent.keyboard("{Escape}");
      await expect.element(dialog).not.toBeInTheDocument();
      await expect.element(drawer()).toBeVisible();
      await expect.poll(() => document.activeElement).toBe(dialogTrigger.element());

      await userEvent.keyboard("{Escape}");
      await expect.element(drawer()).not.toBeInTheDocument();
      await expect.poll(() => document.activeElement).toBe(trigger().element());
    });
  });

  describe("motion", () => {
    it("slides with a 300ms transform transition", async () => {
      await render(<Basic />);
      const popup = await openByClick();
      const style = getComputedStyle(popup);
      expect(style.transitionProperty).toContain("transform");
      expect(style.transitionProperty).toContain("translate");
      expect(style.transitionDuration.split(", ")[0]).toBe("0.3s");
      expect(style.transitionTimingFunction).toMatch(/^cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
      expect(getComputedStyle(backdrop() as HTMLElement).transitionProperty).toBe("opacity");
    });

    /*
     * Real `prefers-reduced-motion: reduce` through CDP, so this checks the cascade (the per-side
     * and data-attribute variants vs `motion-reduce:`), not just the class list.
     */
    it.each(["right", "left", "bottom", "top"] as const)(
      "side=%s: no popup or backdrop transition under prefers-reduced-motion",
      async (side: DrawerSide) => {
        await emulateReducedMotion(true);
        expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
        await render(<Basic side={side} />);
        const popup = await openByClick();
        expect(getComputedStyle(popup).transitionProperty).toBe("none");
        expect(getComputedStyle(backdrop() as HTMLElement).transitionProperty).toBe("none");
      },
    );
  });

  describe("swipe", () => {
    it("a mouse drag across the drawer's text selects it and does not dismiss the drawer", async () => {
      const onOpenChange = vi.fn();
      await render(
        <Basic onOpenChange={onOpenChange}>
          <p data-testid="body" className="px-4 text-sm">
            Order 1042 ships from the Rotterdam warehouse within two business days.
          </p>
        </Basic>,
      );
      const popup = await openByClick();
      const body = page.getByTestId("body");
      const rect = body.element().getBoundingClientRect();
      // Drag rightwards (the right drawer's dismiss direction) across the whole paragraph: further
      // than Base UI's swipe threshold (half the popup width) would be, were it a swipe.
      expect(rect.width).toBeGreaterThan(popup.offsetWidth / 2);
      await userEvent.dragAndDrop(body, body, {
        sourcePosition: { x: 1, y: 4 },
        targetPosition: { x: rect.width - 1, y: rect.height - 4 },
        steps: 12,
      } as Parameters<typeof userEvent.dragAndDrop>[2]);
      const selection = document.getSelection();
      expect(selection?.isCollapsed).toBe(false);
      expect(selection?.toString()).toContain("Rotterdam");
      await expect.element(drawer()).toBeVisible();
      expect(onOpenChange.mock.calls.filter(([open]) => open === false)).toHaveLength(0);
      selection?.removeAllRanges();
    });

    it("dragging a Slider thumb inside a right drawer changes the value and keeps the drawer open", async () => {
      const onOpenChange = vi.fn();
      const onValueChange = vi.fn();
      await render(
        <Basic onOpenChange={onOpenChange}>
          <div className="px-4 py-2">
            <Slider aria-label="Quantity" defaultValue={10} onValueChange={onValueChange} />
          </div>
        </Basic>,
      );
      await openByClick();
      const slider = page.getByRole("slider", { name: "Quantity" });
      const thumb = document.querySelector<HTMLElement>("[data-slot=slider-thumb]");
      if (!thumb) throw new Error("slider thumb not found");
      const track = thumb.parentElement?.getBoundingClientRect() as DOMRect;
      const thumbRect = thumb.getBoundingClientRect();
      // Drag the thumb rightwards, towards the drawer's dismiss direction, to the track's end.
      await userEvent.dragAndDrop(page.elementLocator(thumb), page.elementLocator(thumb), {
        force: true,
        targetPosition: {
          x: track.right - thumbRect.left - 1,
          y: thumbRect.height / 2,
        },
        steps: 12,
      } as Parameters<typeof userEvent.dragAndDrop>[2]);
      await expect
        .poll(() => Number(slider.element().getAttribute("aria-valuenow")))
        .toBeGreaterThan(80);
      expect(onValueChange).toHaveBeenCalled();
      await expect.element(drawer()).toBeVisible();
      expect(onOpenChange.mock.calls.filter(([open]) => open === false)).toHaveLength(0);
    });

    it("a pointer drag down on a bottom drawer dismisses it (reason swipe)", async () => {
      const onOpenChange = vi.fn();
      await render(<Basic side="bottom" onOpenChange={onOpenChange} />);
      const popup = await openByClick();
      const handle = popup.querySelector("[data-slot=drawer-handle]") as HTMLElement;
      // Record what Base UI exposes mid-gesture: `data-swiping` on the popup and backdrop, and the
      // backdrop's `--drawer-swipe-progress` (both set imperatively while the pointer moves).
      const seen = { popupSwiping: false, backdropSwiping: false, progress: 0 };
      const backdropElement = backdrop() as HTMLElement;
      const observer = new MutationObserver(() => {
        seen.popupSwiping ||= popup.hasAttribute("data-swiping");
        seen.backdropSwiping ||= backdropElement.hasAttribute("data-swiping");
        const progress = Number(backdropElement.style.getPropertyValue("--drawer-swipe-progress"));
        seen.progress = Math.max(seen.progress, progress || 0);
      });
      observer.observe(popup, { attributes: true });
      observer.observe(backdropElement, { attributes: true });
      const rect = popup.getBoundingClientRect();
      // Playwright mouse drag (real pointer events, pointerType "mouse") from the handle to the
      // bottom of the viewport: past Base UI's threshold of half the popup height.
      await userEvent.dragAndDrop(
        page.elementLocator(handle),
        page.elementLocator(backdropElement),
        {
          force: true,
          targetPosition: { x: rect.left + rect.width / 2, y: window.innerHeight - 2 },
          steps: 12,
        } as Parameters<typeof userEvent.dragAndDrop>[2],
      );
      await expect.element(drawer()).not.toBeInTheDocument();
      observer.disconnect();
      expect(onOpenChange).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ reason: "swipe" }),
      );
      expect(seen.popupSwiping).toBe(true);
      expect(seen.backdropSwiping).toBe(true);
      expect(seen.progress).toBeGreaterThan(0);
    });

    it("the popup follows --drawer-swipe-movement-y and drops its transition while data-swiping", async () => {
      await render(<Basic side="bottom" />);
      const popup = await openByClick();
      expect(new DOMMatrix(getComputedStyle(popup).transform).m42).toBe(0);
      expect(getComputedStyle(popup).transitionProperty).not.toBe("none");
      popup.setAttribute("data-swiping", "");
      expect(getComputedStyle(popup).transitionProperty).toBe("none");
      // No transition while swiping, so the computed transform is the new value at once.
      popup.style.setProperty("--drawer-swipe-movement-y", "40px");
      expect(new DOMMatrix(getComputedStyle(popup).transform).m42).toBe(40);
      popup.style.setProperty("--drawer-swipe-movement-y", "0px");
      popup.removeAttribute("data-swiping");
    });

    it("side=right follows --drawer-swipe-movement-x", async () => {
      await render(<Basic side="right" />);
      const popup = await openByClick();
      popup.setAttribute("data-swiping", "");
      popup.style.setProperty("--drawer-swipe-movement-x", "30px");
      expect(new DOMMatrix(getComputedStyle(popup).transform).m41).toBe(30);
      popup.style.setProperty("--drawer-swipe-movement-x", "0px");
      popup.removeAttribute("data-swiping");
    });

    it("the backdrop fades with --drawer-swipe-progress and drops its transition while data-swiping", async () => {
      await render(<Basic side="bottom" />);
      await openByClick();
      const element = backdrop() as HTMLElement;
      await waitForPopupSettled(element);
      expect(getComputedStyle(element).opacity).toBe("1");
      element.style.setProperty("--drawer-swipe-progress", "0.5");
      element.setAttribute("data-swiping", "");
      expect(getComputedStyle(element).transitionProperty).toBe("none");
      expect(getComputedStyle(element).opacity).toBe("0.5");
      element.removeAttribute("data-swiping");
      element.style.setProperty("--drawer-swipe-progress", "0");
    });
  });

  it("close button: no outline in forced colors until Tab focus, then a 2px solid ring", async () => {
    await emulateForcedColors(true);
    await render(<Basic />);
    await openByClick();
    const close = page.getByRole("button", { name: "Close" }).element();
    expect(getComputedStyle(close).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(close);
    expect(getComputedStyle(close).outlineStyle).toBe("solid");
    expect(getComputedStyle(close).outlineWidth).toBe("2px");
  });

  it.each([
    ["light", "right"],
    ["dark", "right"],
    ["light", "bottom"],
    ["dark", "bottom"],
  ] as const)("has no axe violations while open (%s, side=%s)", async (theme, side) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    await render(
      <div className="bg-background">
        <WithForm side={side} />
      </div>,
    );
    await openByClick();
    const { violations, incomplete } = await auditOpenOverlay();
    expect(violations).toEqual([]);
    expect(incomplete).toEqual([]);
  });

  const storyList = {
    RightWithForm: stories.RightWithForm,
    LeftNavigation: stories.LeftNavigation,
    BottomSheet: stories.BottomSheet,
    Top: stories.Top,
    NestedDialog: stories.NestedDialog,
  };
  it.each(
    (Object.keys(storyList) as (keyof typeof storyList)[]).flatMap((name) =>
      (["light", "dark"] as const).map((theme) => [name, theme] as const),
    ),
  )("story %s (%s): the open drawer is named, no axe violations", async (name, theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    const story = storyList[name] as { render?: unknown; args?: object };
    const renderStory = (story.render ?? stories.default.render) as unknown as (
      args: object,
    ) => ReactElement;
    // `min-h-dvh`: the page behind the backdrop must span the viewport. A short page wrapper with
    // a background only partly under the drawer's text makes axe's color-contrast "needs review"
    // (elmPartiallyObscuring): it cannot tell which background the text sits on.
    const screen = await render(
      <div className="min-h-dvh bg-background p-4">
        {renderStory({ ...stories.default.args, ...story.args })}
      </div>,
    );
    await userEvent.click(screen.getByRole("button"));
    await expect.element(page.getByRole("dialog")).toBeVisible();
    const popup = page.getByRole("dialog").element() as HTMLElement;
    await waitForPopupSettled(popup);
    expect(popup.getAttribute("aria-labelledby")).toBeTruthy();
    await expect.element(page.getByRole("dialog")).toHaveAccessibleName(/\S/);
    const { violations, incomplete } = await auditOpenOverlay();
    expect(violations).toEqual([]);
    expect(incomplete).toEqual([]);
  });
});
