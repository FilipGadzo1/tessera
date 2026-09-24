import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { Button, buttonVariants } from "../button";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  type MenuContentProps,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "./menu";

interface ActionsProps extends MenuContentProps {
  onEdit?: () => void;
  onArchive?: () => void;
}

function Actions({ onEdit, onArchive, children, ...props }: ActionsProps) {
  // Padding leaves room on every side, so the popup never flips away from `side`.
  return (
    <div className="p-16">
      <Menu>
        <MenuTrigger render={<Button variant="outline" />}>Actions</MenuTrigger>
        <MenuContent {...props}>
          <MenuGroup>
            <MenuGroupLabel>Project</MenuGroupLabel>
            <MenuItem onClick={onEdit}>
              Edit
              <MenuShortcut>⌘E</MenuShortcut>
            </MenuItem>
            <MenuItem disabled>Duplicate</MenuItem>
            <MenuItem onClick={onArchive}>Archive</MenuItem>
          </MenuGroup>
          <MenuSeparator />
          <MenuItem variant="danger">Delete</MenuItem>
          {children}
        </MenuContent>
      </Menu>
    </div>
  );
}

function ViewOptions({ onValueChange }: { onValueChange?: (value: string) => void }) {
  return (
    <div className="p-16">
      <Menu>
        <MenuTrigger render={<Button variant="outline" />}>View</MenuTrigger>
        <MenuContent>
          <MenuCheckboxItem>Show grid</MenuCheckboxItem>
          <MenuCheckboxItem defaultChecked>Show rulers</MenuCheckboxItem>
          <MenuSeparator />
          <MenuGroup>
            <MenuGroupLabel>Sort by</MenuGroupLabel>
            <MenuRadioGroup defaultValue="name" onValueChange={onValueChange}>
              <MenuRadioItem value="name">Name</MenuRadioItem>
              <MenuRadioItem value="date">Date</MenuRadioItem>
            </MenuRadioGroup>
          </MenuGroup>
        </MenuContent>
      </Menu>
    </div>
  );
}

function WithSubmenu() {
  return (
    <div className="p-16">
      <Menu>
        <MenuTrigger render={<Button variant="outline" />}>File</MenuTrigger>
        <MenuContent>
          <MenuItem>New file</MenuItem>
          <MenuSub>
            <MenuSubTrigger>Share</MenuSubTrigger>
            <MenuSubContent>
              <MenuItem>Email</MenuItem>
              <MenuItem>Copy link</MenuItem>
            </MenuSubContent>
          </MenuSub>
        </MenuContent>
      </Menu>
    </div>
  );
}

const menus = () => document.querySelectorAll('[role="menu"]');
const menu = () => page.getByRole("menu");
const item = (name: string) => page.getByRole("menuitem", { name, exact: false });
const trigger = (name = "Actions") => page.getByRole("button", { name });

async function openByClick(name = "Actions") {
  await userEvent.click(trigger(name));
  await expect.element(menu()).toBeVisible();
  const popup = menu().element() as HTMLElement;
  await waitForPopupSettled(popup);
  return popup;
}

function highlighted() {
  return Array.from(document.querySelectorAll("[data-highlighted]")).map((el) =>
    el.textContent?.trim(),
  );
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("Menu", () => {
  it("opens on click as role=menu with named menuitems", async () => {
    await render(<Actions />);
    await expect.element(menu()).not.toBeInTheDocument();
    await expect.element(trigger()).toHaveAttribute("aria-haspopup", "menu");
    await expect.element(trigger()).toHaveAttribute("aria-expanded", "false");
    await openByClick();
    await expect.element(trigger()).toHaveAttribute("aria-expanded", "true");
    await expect.element(page.getByRole("menuitem", { name: "Edit", exact: true })).toBeVisible();
    await expect.element(page.getByRole("menuitem", { name: "Archive" })).toBeVisible();
    await expect.element(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
    await expect.element(page.getByRole("group", { name: "Project" })).toBeVisible();
    await expect.element(page.getByRole("separator")).toBeInTheDocument();
  });

  it("keeps the shortcut out of the item's accessible name (aria-hidden, not overridable)", async () => {
    await render(
      <Actions>
        <MenuItem>
          Rename…
          {/* A caller cannot un-hide it by accident: aria-hidden is set after the props. */}
          <MenuShortcut aria-hidden={false}>F2</MenuShortcut>
        </MenuItem>
      </Actions>,
    );
    await openByClick();
    await expect.element(page.getByRole("menuitem", { name: "Edit", exact: true })).toBeVisible();
    await expect
      .element(page.getByRole("menuitem", { name: "Rename…", exact: true }))
      .toBeVisible();
    const shortcuts = document.querySelectorAll("[data-slot=menu-shortcut]");
    expect(shortcuts).toHaveLength(2);
    for (const shortcut of shortcuts) expect(shortcut.getAttribute("aria-hidden")).toBe("true");
  });

  it("composes the trigger with Button: one button carrying Button's classes", async () => {
    const screen = await render(<Actions />);
    expect(screen.container.querySelectorAll("button")).toHaveLength(1);
    await expect.element(trigger()).toHaveAttribute("data-slot", "button");
    for (const cls of buttonVariants({ variant: "outline" }).split(" ")) {
      expect(trigger().element().classList.contains(cls)).toBe(true);
    }
  });

  it("opens with Enter on the focused trigger and highlights the first item", async () => {
    await render(<Actions />);
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger().element());
    await userEvent.keyboard("{Enter}");
    await expect.element(menu()).toBeVisible();
    await expect.poll(highlighted).toEqual(["Edit⌘E"]);
  });

  it("opens with Space on the focused trigger", async () => {
    await render(<Actions />);
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger().element());
    await userEvent.keyboard(" ");
    await expect.element(menu()).toBeVisible();
    await expect.element(trigger()).toHaveAttribute("aria-expanded", "true");
    await expect.poll(highlighted).toEqual(["Edit⌘E"]);
  });

  it("moves the highlight with ArrowDown / ArrowUp, painting it with bg-accent", async () => {
    const screen = await render(
      <div>
        <Actions />
        <div data-testid="ref" className="bg-accent text-accent-foreground" />
      </div>,
    );
    await openByClick();
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(highlighted).toEqual(["Edit⌘E"]);
    const edit = item("Edit").element() as HTMLElement;
    expect(edit.getAttribute("data-highlighted")).toBe("");
    const reference = getComputedStyle(screen.getByTestId("ref").element());
    await expect.poll(() => getComputedStyle(edit).backgroundColor).toBe(reference.backgroundColor);
    expect(getComputedStyle(edit).color).toBe(reference.color);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await expect.poll(highlighted).toEqual(["Archive"]);
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    await expect.poll(highlighted).toEqual(["Edit⌘E"]);
    expect(edit.hasAttribute("data-highlighted")).toBe(true);
  });

  // Base UI keeps disabled items in the arrow-key sequence (useListNavigation gets
  // `disabledIndices: []`, and items are `focusableWhenDisabled`), as the WAI-ARIA menu pattern
  // recommends so screen-reader users discover them; they cannot be activated.
  it("reaches a disabled item with the arrows but cannot activate it; cursor not-allowed", async () => {
    const onArchive = vi.fn();
    await render(<Actions onArchive={onArchive} />);
    await openByClick();
    const duplicate = item("Duplicate").element() as HTMLElement;
    expect(duplicate.getAttribute("aria-disabled")).toBe("true");
    expect(duplicate.hasAttribute("data-disabled")).toBe(true);
    expect(getComputedStyle(duplicate).cursor).toBe("not-allowed");
    expect(getComputedStyle(duplicate).opacity).toBe("0.5");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await expect.poll(highlighted).toEqual(["Duplicate"]);
    await userEvent.keyboard("{Enter}");
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect.element(menu()).toBeVisible();
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(highlighted).toEqual(["Archive"]);
    await userEvent.keyboard("{Enter}");
    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it("activates the highlighted item with Enter: fires onClick and closes", async () => {
    const onEdit = vi.fn();
    await render(<Actions onEdit={onEdit} />);
    await openByClick();
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(highlighted).toEqual(["Edit⌘E"]);
    await userEvent.keyboard("{Enter}");
    expect(onEdit).toHaveBeenCalledTimes(1);
    await expect.element(menu()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(trigger().element());
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    await render(<Actions />);
    await openByClick();
    await userEvent.keyboard("{Escape}");
    await expect.element(menu()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(trigger().element());
  });

  it("toggles a checkbox item on click, stays open, and shows the check only when checked", async () => {
    await render(<ViewOptions />);
    await openByClick("View");
    const grid = page.getByRole("menuitemcheckbox", { name: "Show grid" });
    const rulers = page.getByRole("menuitemcheckbox", { name: "Show rulers" });
    await expect.element(grid).toHaveAttribute("aria-checked", "false");
    await expect.element(rulers).toHaveAttribute("aria-checked", "true");
    const indicator = (el: Element) => el.querySelector("[data-slot=menu-item-indicator]");
    expect(indicator(grid.element())).toBeNull();
    expect(indicator(rulers.element())).not.toBeNull();
    await userEvent.click(grid);
    await expect.element(grid).toHaveAttribute("aria-checked", "true");
    await expect.element(menu()).toBeVisible();
    await expect.poll(() => indicator(grid.element())).not.toBeNull();
    const check = indicator(grid.element()) as HTMLElement;
    expect(check.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    await userEvent.click(grid);
    await expect.element(grid).toHaveAttribute("aria-checked", "false");
    await expect.poll(() => indicator(grid.element())).toBeNull();
  });

  it("selects a radio item: aria-checked moves and onValueChange fires", async () => {
    const onValueChange = vi.fn();
    await render(<ViewOptions onValueChange={onValueChange} />);
    await openByClick("View");
    const name = page.getByRole("menuitemradio", { name: "Name" });
    const date = page.getByRole("menuitemradio", { name: "Date" });
    await expect.element(name).toHaveAttribute("aria-checked", "true");
    await expect.element(date).toHaveAttribute("aria-checked", "false");
    await userEvent.click(date);
    await expect.element(date).toHaveAttribute("aria-checked", "true");
    await expect.element(name).toHaveAttribute("aria-checked", "false");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("date");
    await expect.element(menu()).toBeVisible();
    expect(date.element().querySelector("[data-slot=menu-item-indicator] svg")).not.toBeNull();
    expect(name.element().querySelector("[data-slot=menu-item-indicator]")).toBeNull();
  });

  it("opens a submenu with ArrowRight and closes it with ArrowLeft", async () => {
    await render(<WithSubmenu />);
    await openByClick("File");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await expect.poll(highlighted).toEqual(["Share"]);
    const share = item("Share").element() as HTMLElement;
    expect(share.getAttribute("aria-haspopup")).toBe("menu");
    expect(share.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => menus().length).toBe(2);
    await expect.element(item("Email")).toBeVisible();
    await expect.poll(highlighted).toContain("Email");
    expect(share.hasAttribute("data-popup-open")).toBe(true);
    await userEvent.keyboard("{ArrowLeft}");
    await expect.poll(() => menus().length).toBe(1);
    await expect.poll(highlighted).toEqual(["Share"]);
  });

  it("aligns the submenu's first item with its trigger item", async () => {
    await render(<WithSubmenu />);
    await openByClick("File");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowRight}");
    await expect.poll(() => menus().length).toBe(2);
    const sub = menus()[1] as HTMLElement;
    await waitForPopupSettled(sub);
    expect(sub.getAttribute("data-slot")).toBe("menu-sub-content");
    expect(sub.getAttribute("data-side")).toBe("inline-end");
    const share = item("Share").element().getBoundingClientRect();
    const email = item("Email").element().getBoundingClientRect();
    expect(Math.round(email.top - share.top)).toBe(0);
  });

  it("sizes a submenu to its content (min-w-32), not to its trigger item's width", async () => {
    await render(
      <div className="p-16">
        <Menu>
          <MenuTrigger render={<Button variant="outline" />}>File</MenuTrigger>
          <MenuContent>
            <MenuItem>Export as a high-resolution PNG image</MenuItem>
            <MenuSub>
              <MenuSubTrigger>Share</MenuSubTrigger>
              <MenuSubContent>
                <MenuItem>Email</MenuItem>
              </MenuSubContent>
            </MenuSub>
          </MenuContent>
        </Menu>
      </div>,
    );
    await openByClick("File");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowRight}");
    await expect.poll(() => menus().length).toBe(2);
    const sub = menus()[1] as HTMLElement;
    await waitForPopupSettled(sub);
    // The submenu's anchor is its trigger item, as wide as the parent menu's content box; with
    // `min-w-(--anchor-width)` a short submenu would be forced at least that wide.
    const shareWidth = item("Share").element().getBoundingClientRect().width;
    expect(sub.getBoundingClientRect().width).toBeLessThan(shareWidth);
    expect(sub.classList.contains("min-w-32")).toBe(true);
    expect(sub.classList.contains("min-w-(--anchor-width)")).toBe(false);
    expect(getComputedStyle(sub).minWidth).toBe("128px");
  });

  it("paints the danger item with text-danger, and bg-danger-soft when highlighted", async () => {
    const screen = await render(
      <div>
        <Actions />
        <div data-testid="ref" className="text-danger" />
        <div data-testid="soft" className="bg-danger-soft text-danger-soft-foreground" />
      </div>,
    );
    await openByClick();
    const del = item("Delete").element() as HTMLElement;
    const reference = getComputedStyle(screen.getByTestId("ref").element());
    const soft = getComputedStyle(screen.getByTestId("soft").element());
    expect(getComputedStyle(del).color).toBe(reference.color);
    await userEvent.hover(del);
    await expect.poll(() => del.hasAttribute("data-highlighted")).toBe(true);
    await expect.poll(() => getComputedStyle(del).backgroundColor).toBe(soft.backgroundColor);
    expect(getComputedStyle(del).color).toBe(soft.color);
  });

  it("gives the highlighted item a transparent 2px solid outline (forced-colors affordance)", async () => {
    await render(<Actions />);
    await openByClick();
    await userEvent.keyboard("{ArrowDown}");
    const edit = item("Edit").element() as HTMLElement;
    await expect.poll(() => edit.hasAttribute("data-highlighted")).toBe(true);
    const style = getComputedStyle(edit);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
    expect(style.outlineColor).toBe("rgba(0, 0, 0, 0)");
    expect(style.outlineOffset).toBe("-2px");
  });

  it("uses a pointer cursor on items", async () => {
    await render(<Actions />);
    await openByClick();
    for (const name of ["Edit", "Archive", "Delete"]) {
      expect(getComputedStyle(item(name).element()).cursor).toBe("pointer");
    }
  });

  it("portals the content to document.body with the overlay z-index", async () => {
    const screen = await render(<Actions />);
    const popup = await openByClick();
    expect(screen.container.contains(popup)).toBe(false);
    expect(document.body.contains(popup)).toBe(true);
    const positioner = popup.parentElement as HTMLElement;
    expect(getComputedStyle(positioner).zIndex).toBe("50");
  });

  it("sets data-slots, defaults to side=bottom align=start 6px below, and merges className", async () => {
    await render(<Actions className="p-2" />);
    const popup = await openByClick();
    expect(popup.getAttribute("data-slot")).toBe("menu-content");
    expect(popup.getAttribute("data-side")).toBe("bottom");
    expect(popup.getAttribute("data-align")).toBe("start");
    expect(popup.classList.contains("p-2")).toBe(true);
    expect(popup.classList.contains("p-1")).toBe(false);
    for (const cls of ["bg-popover", "rounded-lg", "overflow-y-auto", "min-w-(--anchor-width)"]) {
      expect(popup.classList.contains(cls)).toBe(true);
    }
    const t = trigger().element().getBoundingClientRect();
    const p = popup.getBoundingClientRect();
    expect(Math.round(p.top - t.bottom)).toBe(6);
    expect(Math.round(p.left - t.left)).toBe(0);
    const slot = (name: string) => popup.querySelector(`[data-slot=${name}]`) as HTMLElement;
    expect(slot("menu-item").textContent).toBe("Edit⌘E");
    expect(slot("menu-group")).not.toBeNull();
    expect(slot("menu-group-label").className).toBe(
      "px-2 py-1.5 text-xs font-medium text-muted-foreground",
    );
    expect(slot("menu-separator").className).toBe("-mx-1 my-1 h-px bg-border");
    expect(slot("menu-shortcut").tagName).toBe("SPAN");
    expect(slot("menu-shortcut").className).toBe(
      "ml-auto text-xs tracking-widest text-muted-foreground",
    );
  });

  it("sets data-slots on checkbox, radio and sub-trigger items", async () => {
    await render(<ViewOptions />);
    const popup = await openByClick("View");
    expect(popup.querySelectorAll("[data-slot=menu-checkbox-item]")).toHaveLength(2);
    expect(popup.querySelectorAll("[data-slot=menu-radio-item]")).toHaveLength(2);
    expect(popup.querySelector("[data-slot=menu-radio-group]")).not.toBeNull();
    const checkbox = popup.querySelector("[data-slot=menu-checkbox-item]") as HTMLElement;
    expect(checkbox.classList.contains("pl-8")).toBe(true);
    const indicator = popup.querySelector("[data-slot=menu-item-indicator]") as HTMLElement;
    expect(indicator.className).toBe("absolute left-2 flex size-4 items-center justify-center");
  });

  it("marks the sub-trigger with its data-slot and keeps it painted while the submenu is open", async () => {
    const screen = await render(
      <div>
        <WithSubmenu />
        <div data-testid="ref" className="bg-accent" />
      </div>,
    );
    await openByClick("File");
    const share = item("Share").element() as HTMLElement;
    expect(share.getAttribute("data-slot")).toBe("menu-sub-trigger");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowRight}");
    await expect.poll(() => menus().length).toBe(2);
    await expect.poll(() => share.hasAttribute("data-highlighted")).toBe(false);
    expect(share.hasAttribute("data-popup-open")).toBe(true);
    const accent = getComputedStyle(screen.getByTestId("ref").element()).backgroundColor;
    await expect.poll(() => getComputedStyle(share).backgroundColor).toBe(accent);
  });

  it("follows .dark on <html> (portalled content inherits the root theme)", async () => {
    const screen = await render(
      <div>
        <Actions />
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
          <Actions container={scope} />
        </div>
      );
    }
    const screen = await render(<Scoped />);
    const popup = await openByClick();
    expect(screen.getByTestId("scope").element().contains(popup)).toBe(true);
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations while open, with the danger item highlighted and a submenu open (%s)",
    async (theme) => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      try {
        await render(
          <div className="bg-background">
            <Actions>
              <MenuSeparator />
              <MenuCheckboxItem defaultChecked>Pinned</MenuCheckboxItem>
              <MenuRadioGroup defaultValue="a">
                <MenuRadioItem value="a">Private</MenuRadioItem>
                <MenuRadioItem value="b">Public</MenuRadioItem>
              </MenuRadioGroup>
              <MenuSub>
                <MenuSubTrigger>Share</MenuSubTrigger>
                <MenuSubContent>
                  <MenuItem>Email</MenuItem>
                  <MenuItem>Copy link</MenuItem>
                </MenuSubContent>
              </MenuSub>
            </Actions>
          </div>,
        );
        await openByClick();
        // Audit the danger item while highlighted (bg-danger-soft / text-danger-soft-foreground).
        await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
        await expect.poll(highlighted).toEqual(["Delete"]);
        const highlightedDanger = await auditOpenOverlay();
        expect(highlightedDanger.violations).toEqual([]);
        expect(highlightedDanger.incomplete).toEqual([]);
        await userEvent.keyboard("{End}{ArrowRight}");
        await expect.poll(() => menus().length).toBe(2);
        await waitForPopupSettled(menus()[1] as HTMLElement);
        const { violations, incomplete } = await auditOpenOverlay();
        expect(violations).toEqual([]);
        expect(incomplete).toEqual([]);
      } finally {
        document.documentElement.classList.remove("dark");
      }
    },
  );
});
