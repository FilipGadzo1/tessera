import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";
import {
  PreviewCard,
  PreviewCardContent,
  type PreviewCardContentProps,
  PreviewCardTrigger,
} from "./preview-card";

function Basic({ children, ...props }: PreviewCardContentProps) {
  // Padding leaves room on every side, so the card never flips away from `side`.
  return (
    <div className="p-16">
      <PreviewCard>
        <PreviewCardTrigger href="https://example.com/filip" delay={0} closeDelay={0}>
          @filip
        </PreviewCardTrigger>
        <PreviewCardContent {...props}>
          <p>{children ?? "Filip — Tessera author"}</p>
        </PreviewCardContent>
      </PreviewCard>
    </div>
  );
}

const trigger = () => page.getByRole("link", { name: "@filip" });
// Base UI's preview card popup is visual-only (no role), like the tooltip it replaces "hover" with:
// found by its data-slot instead of a role.
const popup = () => document.querySelector('[data-slot="preview-card-content"]') as HTMLElement;

async function openByHover() {
  await userEvent.hover(trigger());
  await expect.poll(() => popup()).not.toBeNull();
  await waitForPopupSettled(popup());
  return popup();
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("PreviewCard", () => {
  it("renders the trigger as a link and opens the card on hover after the delay", async () => {
    await render(<Basic />);
    await expect.element(trigger()).toHaveAttribute("href", "https://example.com/filip");
    expect(popup()).toBeNull();
    await openByHover();
    expect(popup().textContent).toBe("Filip — Tessera author");
  });

  it("closes on unhover", async () => {
    await render(<Basic />);
    await openByHover();
    await userEvent.unhover(trigger());
    await expect.poll(() => popup()).toBeNull();
  });

  it("opens on keyboard focus (Tab)", async () => {
    await render(<Basic />);
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger().element());
    await expect.poll(() => popup()).not.toBeNull();
  });

  it("closes on Escape; a layered tooltip closes first when both are open", async () => {
    await render(
      <div className="p-16">
        <PreviewCard defaultOpen>
          <PreviewCardTrigger href="https://example.com/filip" delay={0} closeDelay={0}>
            @filip
          </PreviewCardTrigger>
          <PreviewCardContent>
            <Tooltip defaultOpen>
              <TooltipTrigger delay={0} closeDelay={0}>
                Info
              </TooltipTrigger>
              <TooltipContent>A tooltip inside the card</TooltipContent>
            </Tooltip>
          </PreviewCardContent>
        </PreviewCard>
      </div>,
    );
    await expect.poll(() => popup()).not.toBeNull();
    await expect.element(page.getByRole("tooltip")).toBeVisible();
    // First Escape closes the (layered) tooltip, not the preview card.
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("tooltip")).not.toBeInTheDocument();
    expect(popup()).not.toBeNull();
  });

  it("closes an uncontrolled card on Escape", async () => {
    await render(<Basic />);
    await openByHover();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => popup()).toBeNull();
  });

  it("portals the content to document.body with the popup-layer z-index", async () => {
    const screen = await render(<Basic />);
    const card = await openByHover();
    expect(screen.container.contains(card)).toBe(false);
    expect(document.body.contains(card)).toBe(true);
    const positioner = card.parentElement as HTMLElement;
    expect(getComputedStyle(positioner).zIndex).toBe("50");
  });

  it("sets data-slot, defaults to side=bottom align=center 8px below, and merges className", async () => {
    await render(<Basic className="w-96" />);
    const card = await openByHover();
    expect(card.getAttribute("data-slot")).toBe("preview-card-content");
    expect(card.getAttribute("data-side")).toBe("bottom");
    expect(card.getAttribute("data-align")).toBe("center");
    expect(card.classList.contains("w-96")).toBe(true);
    expect(card.classList.contains("w-72")).toBe(false);
    for (const cls of ["bg-popover", "rounded-lg", "p-4", "text-sm"]) {
      expect(card.classList.contains(cls)).toBe(true);
    }
    const t = trigger().element().getBoundingClientRect();
    const p = card.getBoundingClientRect();
    expect(Math.round(p.top - t.bottom)).toBe(8);
  });

  it("has no default styling on the trigger (composable, like MenuTrigger)", async () => {
    await render(<Basic />);
    expect(trigger().element().className).toBe("");
  });

  it.each(["light", "dark"] as const)("has no axe violations while open (%s)", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    try {
      await render(
        <div className="bg-background">
          <Basic />
        </div>,
      );
      await openByHover();
      const { violations, incomplete } = await auditOpenOverlay();
      expect(violations).toEqual([]);
      expect(incomplete).toEqual([]);
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });
});
