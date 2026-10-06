import { useRef, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { Button } from "../button";
import { Input } from "../input";
import { Label } from "../label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  type DialogContentProps,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { dialogDefaults, dialogVariants } from "./dialog-variants";

function Basic({ children, ...props }: DialogContentProps) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Edit profile</DialogTrigger>
      <DialogContent {...props}>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update your display name.</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function WithForm(props: DialogContentProps) {
  return (
    <Basic {...props}>
      <div className="grid gap-1.5">
        <Label htmlFor="dialog-name">Name</Label>
        <Input id="dialog-name" defaultValue="Ada" />
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" color="neutral" />}>Cancel</DialogClose>
        <Button>Save</Button>
      </DialogFooter>
    </Basic>
  );
}

const dialog = () => page.getByRole("dialog");
const trigger = () => page.getByRole("button", { name: "Edit profile" });
const backdrop = () => document.querySelector<HTMLElement>("[data-slot=dialog-backdrop]");

async function openByClick() {
  await userEvent.click(trigger());
  await expect.element(dialog()).toBeVisible();
  return dialog().element() as HTMLElement;
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("Dialog", () => {
  it("opens on click as a modal role=dialog, named and described", async () => {
    const screen = await render(<Basic />);
    await expect.element(dialog()).not.toBeInTheDocument();
    const triggerElement = trigger().element();
    const popup = await openByClick();
    await expect.element(dialog()).toHaveAccessibleName("Edit profile");
    await expect.element(dialog()).toHaveAccessibleDescription("Update your display name.");
    expect(popup.getAttribute("aria-modal")).toBe("true");
    // Read directly: the trigger is now aria-hidden, so role queries no longer find it.
    expect(triggerElement.getAttribute("aria-expanded")).toBe("true");
    // Base UI also hides everything outside the dialog from assistive tech while it is open.
    await expect.poll(() => screen.container.getAttribute("aria-hidden")).toBe("true");
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(screen.container.hasAttribute("aria-hidden")).toBe(false);
  });

  it("omits aria-modal when modal={false}", async () => {
    await render(
      <Dialog modal={false}>
        <DialogTrigger>Edit profile</DialogTrigger>
        <DialogContent>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const popup = await openByClick();
    expect(popup.hasAttribute("aria-modal")).toBe(false);
  });

  it("opens with Enter and with Space on the focused trigger", async () => {
    await render(<Basic />);
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger().element());
    await userEvent.keyboard("{Enter}");
    await expect.element(dialog()).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(trigger().element());
    await userEvent.keyboard(" ");
    await expect.element(dialog()).toBeVisible();
  });

  // Base UI's default `initialFocus` (DialogPopup.d.ts): the first tabbable element in the popup.
  it("moves focus to the first tabbable element inside on open", async () => {
    await render(<WithForm />);
    await openByClick();
    await expect
      .poll(() => document.activeElement)
      .toBe(page.getByRole("textbox", { name: "Name" }).element());
  });

  it("traps focus: Tab past the last element wraps to the first", async () => {
    await render(<WithForm />);
    const popup = await openByClick();
    const input = page.getByRole("textbox", { name: "Name" }).element();
    await expect.poll(() => document.activeElement).toBe(input);
    // Name → Cancel → Save → Close (the close button renders last) → back to Name.
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("button", { name: "Cancel" }).element());
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("button", { name: "Save" }).element());
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("button", { name: "Close" }).element());
    await userEvent.tab();
    expect(document.activeElement).toBe(input);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(page.getByRole("button", { name: "Close" }).element());
    expect(popup.contains(document.activeElement)).toBe(true);
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    await render(<WithForm />);
    await openByClick();
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(trigger().element());
  });

  it("closes on a backdrop click", async () => {
    await render(<Basic />);
    await openByClick();
    const element = backdrop();
    expect(element).not.toBeNull();
    // Click the top-left corner: backdrop, well outside the centred popup.
    await userEvent.click(element as HTMLElement, { position: { x: 5, y: 5 } });
    await expect.element(dialog()).not.toBeInTheDocument();
  });

  it("closes from the built-in close button, named Close", async () => {
    await render(<Basic />);
    const popup = await openByClick();
    const close = page.getByRole("button", { name: "Close" });
    const slot = popup.querySelector("[data-slot=dialog-close-button]") as HTMLElement;
    expect(slot).not.toBeNull();
    expect(slot.contains(close.element())).toBe(true);
    expect(slot.className).toBe("absolute end-4 top-4");
    // The close is Tessera's Button: ghost, neutral, icon-sm, with an aria-hidden X icon.
    await expect.element(close).toHaveAttribute("data-slot", "button");
    await expect.element(close).toHaveAttribute("data-variant", "ghost");
    await expect.element(close).toHaveAttribute("data-color", "neutral");
    await expect.element(close).toHaveAttribute("data-size", "icon-sm");
    expect(close.element().querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    await userEvent.click(close);
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(trigger().element());
  });

  it.each(["ltr", "rtl"] as const)(
    "the close button sits 16px from the popup's inline end (%s)",
    async (dir) => {
      await render(<Basic dir={dir} />);
      const popup = await openByClick();
      await waitForPopupSettled(popup);
      const slot = popup.querySelector("[data-slot=dialog-close-button]") as HTMLElement;
      const box = popup.getBoundingClientRect();
      const style = getComputedStyle(popup);
      const button = slot.getBoundingClientRect();
      // Distances from the popup's padding edge (inside the border), as `end-4` measures.
      const fromLeft = button.left - (box.left + Number.parseFloat(style.borderLeftWidth));
      const fromRight = box.right - Number.parseFloat(style.borderRightWidth) - button.right;
      expect(dir === "rtl" ? fromLeft : fromRight).toBeCloseTo(16, 1);
      expect(dir === "rtl" ? fromRight : fromLeft).toBeGreaterThan(100);
    },
  );

  it("closes from DialogClose", async () => {
    await render(<WithForm />);
    await openByClick();
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.element(dialog()).not.toBeInTheDocument();
  });

  it("omits the close button with showCloseButton={false}", async () => {
    await render(<Basic showCloseButton={false} />);
    const popup = await openByClick();
    expect(popup.querySelector("[data-slot=dialog-close-button]")).toBeNull();
    await expect.element(page.getByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it.each([
    ["sm", "max-w-sm"],
    ["md", "max-w-lg"],
    ["lg", "max-w-2xl"],
  ] as const)("size=%s maps to %s", async (size, cls) => {
    await render(<Basic size={size} />);
    const popup = await openByClick();
    expect(popup.classList.contains(cls)).toBe(true);
    for (const other of ["max-w-sm", "max-w-lg", "max-w-2xl"].filter((c) => c !== cls)) {
      expect(popup.classList.contains(other)).toBe(false);
    }
  });

  it("defaults to size md", async () => {
    expect(dialogDefaults.size).toBe("md");
    await render(<Basic />);
    const popup = await openByClick();
    expect(popup.getAttribute("data-size")).toBe("md");
    expect(popup.classList.contains("max-w-lg")).toBe(true);
  });

  it("rejects size={null} in the type, and falls back to md if it arrives anyway", async () => {
    // cva would map null to "no size class" (an uncapped popup); the prop type excludes it.
    // @ts-expect-error null is not a valid size
    await render(<Basic size={null} />);
    const popup = await openByClick();
    expect(popup.getAttribute("data-size")).toBe("md");
    expect(popup.classList.contains("max-w-lg")).toBe(true);
  });

  it("dialogVariants returns the popup classes and merges className", () => {
    const classes = dialogVariants({ size: "sm", className: "p-8" }).split(" ");
    for (const cls of [
      "fixed",
      "left-1/2",
      "top-1/2",
      "z-(--z-overlay)",
      "-translate-x-1/2",
      "-translate-y-1/2",
      "grid",
      "w-[calc(100%-2rem)]",
      "max-h-[calc(100dvh-2rem)]",
      "overflow-y-auto",
      "gap-4",
      "rounded-xl",
      "bg-popover",
      "shadow-xl",
      "max-w-sm",
      "p-8",
    ]) {
      expect(classes).toContain(cls);
    }
    expect(classes).not.toContain("p-6");
    expect(classes).not.toContain("origin-(--transform-origin)");
  });

  it("sets data-slots and part classes, and merges className", async () => {
    await render(<Basic className="gap-6" />);
    const popup = await openByClick();
    expect(popup.getAttribute("data-slot")).toBe("dialog-content");
    expect(popup.classList.contains("gap-6")).toBe(true);
    expect(popup.classList.contains("gap-4")).toBe(false);
    const part = (slot: string) => popup.querySelector(`[data-slot=${slot}]`) as HTMLElement;
    expect(part("dialog-header").className).toBe("flex flex-col gap-1.5");
    expect(part("dialog-title").tagName).toBe("H2");
    expect(part("dialog-title").className).toBe("text-lg font-semibold leading-snug");
    expect(part("dialog-description").className).toBe("text-sm text-muted-foreground");
    expect(backdrop()?.className).toContain("fixed inset-0 z-(--z-overlay) bg-black/50");
  });

  it("renders DialogFooter with the footer layout", async () => {
    await render(<WithForm />);
    const popup = await openByClick();
    const footer = popup.querySelector("[data-slot=dialog-footer]") as HTMLElement;
    expect(footer.className).toBe("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end");
  });

  it("portals the backdrop and popup to document.body", async () => {
    const screen = await render(<Basic />);
    const popup = await openByClick();
    expect(screen.container.contains(popup)).toBe(false);
    expect(document.body.contains(popup)).toBe(true);
    expect(screen.container.contains(backdrop())).toBe(false);
  });

  // Base UI's useScrollLock locks the viewport scroller: <html> when it is itself an overflow
  // container, otherwise <body> (the test page's <html> has overflow: visible, so <body>).
  it("locks background scroll on <body> while open and restores it after close", async () => {
    await render(<Basic />);
    expect(getComputedStyle(document.documentElement).overflowY).toBe("visible");
    const before = getComputedStyle(document.body).overflowY;
    expect(before).not.toBe("hidden");
    await openByClick();
    await expect.poll(() => getComputedStyle(document.body).overflowY).toBe("hidden");
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.poll(() => getComputedStyle(document.body).overflowY).toBe(before);
  });

  it("puts the backdrop and popup on the overlay z-index and the popover surface", async () => {
    const screen = await render(
      <div>
        <Basic />
        <div data-testid="ref" className="bg-popover text-popover-foreground" />
      </div>,
    );
    const popup = await openByClick();
    expect(getComputedStyle(popup).zIndex).toBe("50");
    expect(getComputedStyle(backdrop() as HTMLElement).zIndex).toBe("50");
    const reference = screen.getByTestId("ref").element();
    expect(getComputedStyle(popup).backgroundColor).toBe(
      getComputedStyle(reference).backgroundColor,
    );
    expect(getComputedStyle(popup).color).toBe(getComputedStyle(reference).color);
  });

  it("centres the popup in the viewport", async () => {
    await render(<Basic />);
    const popup = await openByClick();
    await waitForPopupSettled(popup);
    const rect = popup.getBoundingClientRect();
    expect(Math.round(rect.left + rect.width / 2)).toBe(Math.round(window.innerWidth / 2));
    expect(Math.round(rect.top + rect.height / 2)).toBe(Math.round(window.innerHeight / 2));
  });

  it("keeps long content inside the viewport and scrolls it", async () => {
    await render(
      <Basic>
        <div data-testid="long" style={{ height: "3000px" }} />
      </Basic>,
    );
    const popup = await openByClick();
    await waitForPopupSettled(popup);
    const rect = popup.getBoundingClientRect();
    expect(rect.top).toBeGreaterThanOrEqual(15);
    expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight - 15);
    expect(popup.scrollHeight).toBeGreaterThan(popup.clientHeight);
    expect(getComputedStyle(popup).overflowY).toBe("auto");
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
    try {
      const popup = await openByClick();
      const darkBg = getComputedStyle(reference).backgroundColor;
      expect(darkBg).not.toBe(lightBg);
      expect(getComputedStyle(popup).backgroundColor).toBe(darkBg);
    } finally {
      document.documentElement.classList.remove("dark");
    }
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>Edit profile</DialogTrigger>
            <DialogContent>
              <DialogTitle>Edit profile</DialogTitle>
            </DialogContent>
          </Dialog>
        </div>
      );
    }
    const screen = await render(<Controlled />);
    await openByClick();
    await expect.element(screen.getByTestId("state")).toHaveTextContent("open");
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.element(screen.getByTestId("state")).toHaveTextContent("closed");
  });

  it.each(["light", "dark"] as const)("has no axe violations while open (%s)", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    try {
      await render(
        <div className="bg-background">
          <WithForm />
        </div>,
      );
      const popup = await openByClick();
      await waitForPopupSettled(popup);
      const { violations, incomplete } = await auditOpenOverlay();
      expect(violations).toEqual([]);
      expect(incomplete).toEqual([]);
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });
});
