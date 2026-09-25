import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
} from "../menu";
import {
  ContextMenu,
  ContextMenuContent,
  type ContextMenuContentProps,
  ContextMenuTrigger,
} from "./context-menu";

interface AreaProps extends ContextMenuContentProps {
  onDelete?: () => void;
  children?: React.ReactNode;
}

function Area({ onDelete, children, ...props }: AreaProps) {
  return (
    <div className="p-16">
      <ContextMenu>
        <ContextMenuTrigger
          data-testid="area"
          className="flex h-32 w-64 items-center justify-center border border-dashed"
        >
          Right-click here
        </ContextMenuTrigger>
        <ContextMenuContent {...props}>
          <MenuItem>Back</MenuItem>
          <MenuItem>Reload</MenuItem>
          <MenuSeparator />
          <MenuItem variant="danger" onClick={onDelete}>
            Delete
          </MenuItem>
          {children}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

const menu = () => page.getByRole("menu");
const area = () => page.getByTestId("area");
const item = (name: string) => page.getByRole("menuitem", { name, exact: false });

function rightClick(target: Element, clientX: number, clientY: number) {
  target.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX, clientY }),
  );
}

async function openAt(clientX: number, clientY: number) {
  rightClick(area().element(), clientX, clientY);
  await expect.element(menu()).toBeVisible();
  const popup = menu().element() as HTMLElement;
  await waitForPopupSettled(popup);
  return popup;
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("ContextMenu", () => {
  it("is closed until a right-click opens it as role=menu", async () => {
    await render(<Area />);
    await expect.element(menu()).not.toBeInTheDocument();
    await openAt(120, 140);
    await expect.element(item("Back")).toBeVisible();
    await expect.element(item("Delete")).toBeVisible();
  });

  it("opens with the popup's top-left at the pointer (within 2px)", async () => {
    await render(<Area />);
    const popup = await openAt(150, 180);
    const rect = popup.getBoundingClientRect();
    expect(Math.abs(rect.left - 150)).toBeLessThanOrEqual(2);
    expect(Math.abs(rect.top - 180)).toBeLessThanOrEqual(2);
  });

  it("reuses the Menu items unchanged: MenuItem, danger variant and click both fire and close", async () => {
    const onDelete = vi.fn();
    await render(<Area onDelete={onDelete} />);
    const popup = await openAt(100, 100);
    expect(popup.querySelectorAll("[data-slot=menu-item]")).toHaveLength(3);
    await userEvent.click(item("Delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
    await expect.element(menu()).not.toBeInTheDocument();
  });

  it("reuses MenuCheckboxItem inside the content", async () => {
    await render(
      <Area>
        <MenuCheckboxItem defaultChecked>Show hidden files</MenuCheckboxItem>
      </Area>,
    );
    await openAt(100, 100);
    const checkbox = page.getByRole("menuitemcheckbox", { name: "Show hidden files" });
    await expect.element(checkbox).toHaveAttribute("aria-checked", "true");
    await userEvent.click(checkbox);
    await expect.element(checkbox).toHaveAttribute("aria-checked", "false");
    await expect.element(menu()).toBeVisible();
  });

  it("reuses a submenu (MenuSub/MenuSubTrigger/MenuSubContent) inside the content", async () => {
    await render(
      <Area>
        <MenuSub>
          <MenuSubTrigger>More tools</MenuSubTrigger>
          <MenuSubContent>
            <MenuItem>Developer tools</MenuItem>
          </MenuSubContent>
        </MenuSub>
      </Area>,
    );
    await openAt(100, 100);
    const trigger = item("More tools").element() as HTMLElement;
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    await userEvent.click(trigger);
    await expect.element(item("Developer tools")).toBeVisible();
  });

  it("closes on Escape and returns focus to where it was", async () => {
    await render(
      <div>
        <button type="button">Elsewhere</button>
        <Area />
      </div>,
    );
    const elsewhere = page.getByRole("button", { name: "Elsewhere" }).element() as HTMLElement;
    elsewhere.focus();
    expect(document.activeElement).toBe(elsewhere);
    await openAt(100, 100);
    await userEvent.keyboard("{Escape}");
    await expect.element(menu()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(elsewhere);
  });

  // *Amended in Task 3*: Base UI 1.8's `ContextMenuTrigger` (checked in
  // node_modules/@base-ui/react/context-menu/trigger/ContextMenuTrigger.js) wires only
  // `onContextMenu`, `onTouchStart` and `onTouchMove` — there is no `keydown` handler, so neither
  // the ContextMenu key nor Shift+F10 opens it while the trigger area is focused. This test
  // records that: focusing and pressing the key combos leaves it closed.
  it("does not open on keyboard (Shift+F10) — Base UI 1.8 has no keyboard opening for ContextMenuTrigger", async () => {
    await render(<Area />);
    area().element().focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await expect.element(menu()).not.toBeInTheDocument();
  });

  it("sets data-slot on the trigger and content, min-w-32 (not anchor width), and merges className", async () => {
    await render(<Area className="w-80" />);
    await expect.element(area()).toHaveAttribute("data-slot", "context-menu-trigger");
    const popup = await openAt(100, 100);
    expect(popup.getAttribute("data-slot")).toBe("context-menu-content");
    expect(popup.classList.contains("w-80")).toBe(true);
    expect(popup.classList.contains("min-w-32")).toBe(true);
    expect(popup.classList.contains("min-w-(--anchor-width)")).toBe(false);
    for (const cls of ["bg-popover", "rounded-lg", "overflow-y-auto", "p-1"]) {
      expect(popup.classList.contains(cls)).toBe(true);
    }
  });

  it("portals the content to document.body with the overlay z-index", async () => {
    const screen = await render(<Area />);
    const popup = await openAt(100, 100);
    expect(screen.container.contains(popup)).toBe(false);
    expect(document.body.contains(popup)).toBe(true);
    const positioner = popup.parentElement as HTMLElement;
    expect(getComputedStyle(positioner).zIndex).toBe("50");
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations while open, with a submenu open (%s)",
    async (theme) => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      try {
        await render(
          <div className="bg-background">
            <Area>
              <MenuSub>
                <MenuSubTrigger>More tools</MenuSubTrigger>
                <MenuSubContent>
                  <MenuItem>Developer tools</MenuItem>
                </MenuSubContent>
              </MenuSub>
            </Area>
          </div>,
        );
        await openAt(100, 100);
        await userEvent.click(item("More tools"));
        await expect.element(item("Developer tools")).toBeVisible();
        const { violations, incomplete } = await auditOpenOverlay();
        expect(violations).toEqual([]);
        expect(incomplete).toEqual([]);
      } finally {
        document.documentElement.classList.remove("dark");
      }
    },
  );
});
