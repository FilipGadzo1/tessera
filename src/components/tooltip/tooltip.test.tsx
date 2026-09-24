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
    expect(popup.classList.contains("bg-neutral")).toBe(true);
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

  it("uses the inverted neutral background and the tooltip z-index", async () => {
    const screen = await render(
      <div>
        <Basic />
        <div data-testid="ref" className="bg-neutral text-neutral-foreground" />
      </div>,
    );
    const popup = await openByHover();
    const reference = screen.getByTestId("ref").element();
    expect(getComputedStyle(popup).backgroundColor).toBe(
      getComputedStyle(reference).backgroundColor,
    );
    expect(getComputedStyle(popup).color).toBe(getComputedStyle(reference).color);
    const positioner = popup.parentElement as HTMLElement;
    expect(getComputedStyle(positioner).zIndex).toBe("60");
  });

  it("follows .dark on <html> (portalled content inherits the root theme)", async () => {
    const screen = await render(
      <div>
        <Basic />
        <div data-testid="ref" className="bg-neutral" />
      </div>,
    );
    const reference = screen.getByTestId("ref").element();
    const lightBg = getComputedStyle(reference).backgroundColor;
    document.documentElement.classList.add("dark");
    try {
      const popup = await openByHover();
      const darkBg = getComputedStyle(reference).backgroundColor;
      expect(darkBg).not.toBe(lightBg);
      expect(getComputedStyle(popup).backgroundColor).toBe(darkBg);
    } finally {
      document.documentElement.classList.remove("dark");
    }
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
