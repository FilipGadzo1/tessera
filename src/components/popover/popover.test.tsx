import { useRef, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { Button, buttonVariants } from "../button";
import { Input } from "../input";
import { Label } from "../label";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  type PopoverContentProps,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "./popover";

function Basic({ children, ...props }: PopoverContentProps) {
  // Padding leaves room on every side, so the popup never flips away from `side`.
  return (
    <div className="p-16">
      <Popover>
        <PopoverTrigger render={<Button variant="outline" />}>Dimensions</PopoverTrigger>
        <PopoverContent {...props}>
          <PopoverTitle>Dimensions</PopoverTitle>
          <PopoverDescription>Set the layer size.</PopoverDescription>
          {children}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function WithForm(props: PopoverContentProps) {
  return (
    <Basic {...props}>
      <div className="grid gap-1.5">
        <Label htmlFor="popover-width">Width</Label>
        <Input id="popover-width" defaultValue="100%" />
      </div>
      <PopoverClose render={<Button size="sm" />}>Done</PopoverClose>
    </Basic>
  );
}

const dialog = () => page.getByRole("dialog");
const trigger = () => page.getByRole("button", { name: "Dimensions" });

async function openByClick() {
  await userEvent.click(trigger());
  await expect.element(dialog()).toBeVisible();
  return dialog().element() as HTMLElement;
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("Popover direction", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("dir");
  });

  // An RTL page (`dir` on <html>): Floating UI resolves `start` / `end` from the popup's own
  // computed direction, which a portalled popup takes from its container (spec §7, portal note).
  // `w-40` fits on either side of the trigger, so no collision flip can line the edges up.
  it.each([
    ["ltr", "left"],
    ["rtl", "right"],
  ] as const)(
    "%s page: align start lines the popup up with the trigger's %s edge",
    async (dir, edge) => {
      document.documentElement.setAttribute("dir", dir);
      await render(<Basic align="start" className="w-40" />);
      const popup = await openByClick();
      await waitForPopupSettled(popup);
      const t = trigger().element().getBoundingClientRect();
      expect(popup.getBoundingClientRect().width).toBeGreaterThan(t.width + 20);
      expect(Math.abs(popup.getBoundingClientRect()[edge] - t[edge])).toBeLessThanOrEqual(1);
    },
  );

  it.each([
    ["ltr", "left"],
    ["rtl", "right"],
  ] as const)(
    "a dir=%s wrapper (not <html>): the popup takes the direction and align start meets the trigger's %s edge",
    async (dir, edge) => {
      await render(
        <div dir={dir}>
          <Basic align="start" className="w-40" />
        </div>,
      );
      const popup = await openByClick();
      await waitForPopupSettled(popup);
      expect(getComputedStyle(popup).direction).toBe(dir);
      const t = trigger().element().getBoundingClientRect();
      expect(popup.getBoundingClientRect().width).toBeGreaterThan(t.width + 20);
      expect(Math.abs(popup.getBoundingClientRect()[edge] - t[edge])).toBeLessThanOrEqual(1);
    },
  );

  it("an LTR island in an RTL page: the positioner carries dir=ltr, align start meets the left edge", async () => {
    document.documentElement.setAttribute("dir", "rtl");
    await render(
      <div dir="ltr">
        <Basic align="start" className="w-40" />
      </div>,
    );
    const popup = await openByClick();
    await waitForPopupSettled(popup);
    expect(popup.parentElement?.getAttribute("dir")).toBe("ltr");
    const t = trigger().element().getBoundingClientRect();
    expect(popup.getBoundingClientRect().width).toBeGreaterThan(t.width + 20);
    expect(Math.abs(popup.getBoundingClientRect().left - t.left)).toBeLessThanOrEqual(1);
  });

  it.each(["ltr", "rtl"] as const)(
    "%s: side inline-end places the popup after the trigger in the reading order",
    async (dir) => {
      await render(
        <div dir={dir} className="flex justify-center">
          <Basic side="inline-end" className="w-32" />
        </div>,
      );
      const popup = await openByClick();
      await waitForPopupSettled(popup);
      const t = trigger().element().getBoundingClientRect();
      const p = popup.getBoundingClientRect();
      if (dir === "rtl") expect(p.right).toBeLessThanOrEqual(t.left);
      else expect(p.left).toBeGreaterThanOrEqual(t.right);
    },
  );

  it("follows a dir change on an ancestor after mount", async () => {
    await render(
      <div data-testid="host" className="flex justify-center">
        <Basic side="inline-end" className="w-32" />
      </div>,
    );
    page.getByTestId("host").element().setAttribute("dir", "rtl");
    const popup = await openByClick();
    await expect
      .poll(
        () =>
          popup.getBoundingClientRect().right - trigger().element().getBoundingClientRect().left,
      )
      .toBeLessThanOrEqual(0);
  });
});

describe("Popover", () => {
  it("opens on click as role=dialog, named by the title and described by the description", async () => {
    await render(<Basic />);
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.element(trigger()).toHaveAttribute("aria-expanded", "false");
    await openByClick();
    await expect.element(dialog()).toHaveAccessibleName("Dimensions");
    await expect.element(dialog()).toHaveAccessibleDescription("Set the layer size.");
    await expect.element(trigger()).toHaveAttribute("aria-expanded", "true");
    await expect.element(trigger()).toHaveAttribute("aria-controls", dialog().element().id);
  });

  it("composes the trigger with Button: one button carrying Button's classes", async () => {
    const screen = await render(<Basic />);
    expect(screen.container.querySelectorAll("button")).toHaveLength(1);
    await expect.element(trigger()).toHaveAttribute("data-slot", "button");
    for (const cls of buttonVariants({ variant: "outline" }).split(" ")) {
      expect(trigger().element().classList.contains(cls)).toBe(true);
    }
  });

  it("positions against `anchor` instead of the trigger", async () => {
    function Anchored() {
      const anchorRef = useRef<HTMLDivElement>(null);
      return (
        <div className="p-16">
          <div ref={anchorRef} data-testid="anchor" className="h-10 w-24 bg-muted">
            <Popover>
              <PopoverTrigger render={<Button variant="outline" size="sm" className="ms-10" />}>
                Open
              </PopoverTrigger>
              <PopoverContent anchor={anchorRef} align="start">
                <PopoverTitle>Anchored</PopoverTitle>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      );
    }
    await render(<Anchored />);
    await userEvent.click(page.getByRole("button", { name: "Open" }));
    const popup = document.querySelector("[data-slot=popover-content]") as HTMLElement;
    await waitForPopupSettled(popup);
    const anchor = document.querySelector("[data-testid=anchor]") as HTMLElement;
    expect(
      Math.abs(popup.getBoundingClientRect().left - anchor.getBoundingClientRect().left),
    ).toBeLessThanOrEqual(1);
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    await render(<WithForm />);
    await openByClick();
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(trigger().element());
  });

  it("closes on an outside click", async () => {
    await render(
      <div>
        <button type="button">Outside</button>
        <Basic />
      </div>,
    );
    await openByClick();
    await userEvent.click(page.getByRole("button", { name: "Outside" }));
    await expect.element(dialog()).not.toBeInTheDocument();
  });

  it("closes from PopoverClose", async () => {
    await render(<WithForm />);
    await openByClick();
    await userEvent.click(page.getByRole("button", { name: "Done" }));
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(trigger().element());
  });

  it("opens with Enter on the focused trigger", async () => {
    await render(<Basic />);
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger().element());
    await userEvent.keyboard("{Enter}");
    await expect.element(dialog()).toBeVisible();
  });

  it("opens with Space on the focused trigger", async () => {
    await render(<Basic />);
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger().element());
    await userEvent.keyboard(" ");
    await expect.element(dialog()).toBeVisible();
  });

  // Base UI's default `initialFocus` (PopoverPopup.d.ts): focus moves to the first tabbable element
  // in the popup, or to the popup itself when it has none (and on touch opens).
  it("moves focus to the first tabbable element in the popup on open", async () => {
    await render(<WithForm />);
    await openByClick();
    await expect
      .poll(() => document.activeElement)
      .toBe(page.getByRole("textbox", { name: "Width" }).element());
  });

  it("focuses the popup itself when it has no tabbable content", async () => {
    await render(<Basic />);
    const popup = await openByClick();
    await expect.poll(() => document.activeElement).toBe(popup);
  });

  it("portals the content to document.body, outside the render container", async () => {
    const screen = await render(<Basic />);
    const popup = await openByClick();
    expect(screen.container.contains(popup)).toBe(false);
    expect(document.body.contains(popup)).toBe(true);
  });

  it("sets data-slots, defaults to side=bottom, and merges className", async () => {
    await render(<Basic className="w-96" />);
    const popup = await openByClick();
    expect(popup.getAttribute("data-slot")).toBe("popover-content");
    expect(popup.getAttribute("data-side")).toBe("bottom");
    expect(popup.getAttribute("data-align")).toBe("center");
    expect(popup.classList.contains("w-96")).toBe(true);
    expect(popup.classList.contains("w-72")).toBe(false);
    for (const cls of ["bg-popover", "p-4", "flex", "flex-col", "gap-2", "rounded-lg"]) {
      expect(popup.classList.contains(cls)).toBe(true);
    }
    const title = popup.querySelector("[data-slot=popover-title]") as HTMLElement;
    expect(title.textContent).toBe("Dimensions");
    expect(title.className).toBe("text-base font-semibold leading-snug");
    const description = popup.querySelector("[data-slot=popover-description]") as HTMLElement;
    expect(description.className).toBe("text-sm text-muted-foreground");
  });

  it("passes side to the positioner and sits 6px from the trigger", async () => {
    // Extra room above the trigger so side="top" does not flip.
    await render(
      <div className="pt-64">
        <Basic side="top" />
      </div>,
    );
    const popup = await openByClick();
    expect(popup.getAttribute("data-side")).toBe("top");
    await waitForPopupSettled(popup);
    const gap =
      trigger().element().getBoundingClientRect().top - popup.getBoundingClientRect().bottom;
    expect(Math.round(gap)).toBe(6);
  });

  it("uses the popover surface colours and the overlay z-index", async () => {
    const screen = await render(
      <div>
        <Basic />
        <div data-testid="ref" className="bg-popover text-popover-foreground" />
      </div>,
    );
    const popup = await openByClick();
    const reference = screen.getByTestId("ref").element();
    expect(getComputedStyle(popup).backgroundColor).toBe(
      getComputedStyle(reference).backgroundColor,
    );
    expect(getComputedStyle(popup).color).toBe(getComputedStyle(reference).color);
    const positioner = popup.parentElement as HTMLElement;
    expect(getComputedStyle(positioner).zIndex).toBe("50");
  });

  it("follows .dark on <html> (portalled content inherits the root theme)", async () => {
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
        <div data-testid="default-ref" className="bg-primary" />
        <div data-primary="lapis">
          <div data-testid="lapis-ref" className="bg-primary" />
        </div>
      </div>,
    );
    const popup = await openByClick();
    expect(screen.getByTestId("scope").element().contains(popup)).toBe(true);
    const lapis = getComputedStyle(screen.getByTestId("lapis-ref").element()).backgroundColor;
    const fallback = getComputedStyle(screen.getByTestId("default-ref").element()).backgroundColor;
    expect(lapis).not.toBe(fallback);
    const swatch = page.getByTestId("swatch").element();
    expect(getComputedStyle(swatch).backgroundColor).toBe(lapis);
  });

  it("supports controlled open state", async () => {
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <span data-testid="state">{open ? "open" : "closed"}</span>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger>Dimensions</PopoverTrigger>
            <PopoverContent>
              <PopoverTitle>Dimensions</PopoverTitle>
            </PopoverContent>
          </Popover>
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
      // Let the opacity transition settle so contrast is measured at rest.
      await waitForPopupSettled(popup);
      // Portalled, so audited on document.body; see auditOpenOverlay for the two scoped exclusions.
      const { violations, incomplete } = await auditOpenOverlay();
      expect(violations).toEqual([]);
      expect(incomplete).toEqual([]);
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });
});
