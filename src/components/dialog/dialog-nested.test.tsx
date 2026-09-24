import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { Button } from "../button";
import { Input } from "../input";
import { Label } from "../label";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../menu";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "../popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

/** A modal Dialog holding a Menu, a Popover and a Tooltip, each triggered from inside it. */
function Settings({ onDuplicate }: { onDuplicate?: () => void }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Open settings</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Project settings with nested overlays.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Menu>
            <MenuTrigger render={<Button variant="outline" />}>More</MenuTrigger>
            <MenuContent>
              <MenuItem onClick={onDuplicate}>Duplicate</MenuItem>
              <MenuItem>Archive</MenuItem>
            </MenuContent>
          </Menu>
          <Popover>
            <PopoverTrigger render={<Button variant="outline" />}>Share</PopoverTrigger>
            <PopoverContent>
              <PopoverTitle>Share settings</PopoverTitle>
              <PopoverDescription>Invite someone by email.</PopoverDescription>
              <Label htmlFor="nested-email">Email</Label>
              <Input id="nested-email" />
            </PopoverContent>
          </Popover>
          <Tooltip>
            <TooltipTrigger delay={0} closeDelay={0} render={<Button variant="outline" />}>
              Help
            </TooltipTrigger>
            <TooltipContent>Opens the help centre</TooltipContent>
          </Tooltip>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const dialog = () => page.getByRole("dialog", { name: "Settings" });

async function openDialog() {
  await userEvent.click(page.getByRole("button", { name: "Open settings" }));
  await expect.element(dialog()).toBeVisible();
  await waitForPopupSettled(dialog().element());
}

type Case = "menu" | "popover" | "tooltip";

/** Opens the nested overlay from inside the open dialog; returns its popup once at rest. */
async function openNested(kind: Case) {
  if (kind === "menu") {
    await userEvent.click(page.getByRole("button", { name: "More" }));
    await expect.element(page.getByRole("menu")).toBeVisible();
  } else if (kind === "popover") {
    await userEvent.click(page.getByRole("button", { name: "Share" }));
    await expect.element(page.getByRole("dialog", { name: "Share settings" })).toBeVisible();
  } else {
    await userEvent.hover(page.getByRole("button", { name: "Help" }));
    await expect.element(page.getByRole("tooltip")).toBeVisible();
  }
  const popup = nestedPopup(kind);
  if (!popup) throw new Error(`${kind} popup not found`);
  await waitForPopupSettled(popup);
  return popup;
}

function nestedPopup(kind: Case) {
  return document.querySelector<HTMLElement>(`[data-slot=${kind}-content]`);
}

/** Neither inside a subtree Base UI hid behind the modal nor under any aria-hidden / inert node. */
function hiddenAncestor(element: Element) {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (node.hasAttribute("data-base-ui-inert")) return "data-base-ui-inert";
    if (node.getAttribute("aria-hidden") === "true") return "aria-hidden";
    if (node.hasAttribute("inert")) return "inert";
  }
  return null;
}

/** The element painted at the popup's centre belongs to the popup, i.e. it stacks above the dialog. */
function topmostAtCentre(popup: HTMLElement) {
  const rect = popup.getBoundingClientRect();
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return hit !== null && popup.contains(hit);
}

/** The popup overlaps the dialog, so the stacking check is meaningful. */
function overlapsDialog(popup: HTMLElement) {
  const a = popup.getBoundingClientRect();
  const b = dialog().element().getBoundingClientRect();
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("Overlays nested in a modal Dialog", () => {
  it.each(["menu", "popover", "tooltip"] as const)(
    "%s: opens above the dialog and is not hidden or inert",
    async (kind) => {
      await render(<Settings />);
      await openDialog();
      const popup = await openNested(kind);
      expect(hiddenAncestor(popup)).toBeNull();
      expect(overlapsDialog(popup)).toBe(true);
      expect(topmostAtCentre(popup)).toBe(true);
    },
  );

  it("menu: an item click fires and closes only the menu", async () => {
    const onDuplicate = vi.fn();
    await render(<Settings onDuplicate={onDuplicate} />);
    await openDialog();
    await openNested("menu");
    await userEvent.click(page.getByRole("menuitem", { name: "Duplicate" }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
    await expect.element(dialog()).toBeVisible();
  });

  it("popover: its input takes focus and typing", async () => {
    await render(<Settings />);
    await openDialog();
    await openNested("popover");
    const email = page.getByRole("textbox", { name: "Email" });
    await userEvent.click(email);
    await userEvent.keyboard("ada@example.com");
    await expect.element(email).toHaveValue("ada@example.com");
    expect(document.activeElement).toBe(email.element());
  });

  it("tooltip: describes its trigger inside the dialog", async () => {
    await render(<Settings />);
    await openDialog();
    const popup = await openNested("tooltip");
    await expect
      .element(page.getByRole("button", { name: "Help" }))
      .toHaveAttribute("aria-describedby", popup.id);
  });

  it.each(["menu", "popover", "tooltip"] as const)(
    "%s: Escape closes the inner overlay first; the dialog stays open",
    async (kind) => {
      await render(<Settings />);
      await openDialog();
      await openNested(kind);
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => nestedPopup(kind)).toBeNull();
      await expect.element(dialog()).toBeVisible();
      await userEvent.keyboard("{Escape}");
      await expect.element(dialog()).not.toBeInTheDocument();
    },
  );

  it("tooltip opened by keyboard focus: Escape closes it first; the dialog stays open", async () => {
    await render(<Settings />);
    await openDialog();
    const help = page.getByRole("button", { name: "Help" });
    for (let i = 0; i < 6 && document.activeElement !== help.element(); i++) {
      await userEvent.tab();
    }
    expect(document.activeElement).toBe(help.element());
    await expect.element(page.getByRole("tooltip")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => nestedPopup("tooltip")).toBeNull();
    await expect.element(dialog()).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
  });

  describe.each(["light", "dark"] as const)("axe (%s)", (theme) => {
    it.each(["menu", "popover", "tooltip"] as const)("%s open inside the dialog", async (kind) => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      try {
        // The page behind the backdrop needs the theme background, as in the other axe tests.
        await render(
          <div className="bg-background">
            <Settings />
          </div>,
        );
        await openDialog();
        await openNested(kind);
        const { violations, incomplete } = await auditOpenOverlay();
        expect(violations).toEqual([]);
        expect(incomplete).toEqual([]);
      } finally {
        document.documentElement.classList.remove("dark");
      }
    });
  });
});
