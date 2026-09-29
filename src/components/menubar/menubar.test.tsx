import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, resetEmulatedMedia, systemColor } from "../../../test/emulation";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
} from "../menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";
import { Menubar, type MenubarProps, MenubarTrigger } from "./menubar";

interface AppMenubarProps extends MenubarProps {
  onNew?: () => void;
  onWrapChange?: (checked: boolean) => void;
}

function AppMenubar({ onNew, onWrapChange, ...props }: AppMenubarProps) {
  return (
    <div className="p-16">
      <Menubar aria-label="Application" {...props}>
        <Menu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenuContent>
            <MenuItem onClick={onNew}>
              New
              <MenuShortcut>⌘N</MenuShortcut>
            </MenuItem>
            <MenuItem>Open…</MenuItem>
            <MenuSeparator />
            <MenuSub>
              <MenuSubTrigger>Export</MenuSubTrigger>
              <MenuSubContent>
                <MenuItem>PDF</MenuItem>
                <MenuItem>PNG</MenuItem>
              </MenuSubContent>
            </MenuSub>
          </MenuContent>
        </Menu>
        <Menu>
          <MenubarTrigger>Edit</MenubarTrigger>
          <MenuContent>
            <MenuItem>Undo</MenuItem>
            <MenuItem>Redo</MenuItem>
          </MenuContent>
        </Menu>
        <Menu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenuContent>
            <MenuCheckboxItem defaultChecked onCheckedChange={onWrapChange}>
              Word wrap
            </MenuCheckboxItem>
          </MenuContent>
        </Menu>
      </Menubar>
    </div>
  );
}

const trigger = (name: string) => page.getByRole("menuitem", { name, exact: true });
const item = (name: string) => page.getByRole("menuitem", { name, exact: false });
const menus = () => document.querySelectorAll('[role="menu"]');

async function openByClick(name: string) {
  await userEvent.click(trigger(name));
  await expect.poll(() => menus().length).toBeGreaterThan(0);
  const popup = menus()[menus().length - 1] as HTMLElement;
  await waitForPopupSettled(popup);
  return popup;
}

afterEach(async () => {
  await resetEmulatedMedia();
  document.documentElement.classList.remove("dark");
});

describe("Menubar", () => {
  it("renders role=menubar with menuitem triggers that reuse the Menu parts", async () => {
    await render(<AppMenubar />);
    await expect.element(page.getByRole("menubar", { name: "Application" })).toBeVisible();
    for (const name of ["File", "Edit", "View"]) {
      await expect.element(trigger(name)).toHaveAttribute("aria-haspopup", "menu");
      await expect.element(trigger(name)).toHaveAttribute("aria-expanded", "false");
    }
    const popup = await openByClick("File");
    expect(popup.getAttribute("data-slot")).toBe("menu-content");
    await expect.element(item("New")).toBeVisible();
    expect(popup.querySelector("[data-slot=menu-item]")).not.toBeNull();
    expect(popup.querySelector("[data-slot=menu-shortcut]")).not.toBeNull();
    expect(popup.querySelector("[data-slot=menu-separator]")).not.toBeNull();
    expect(popup.querySelector("[data-slot=menu-sub-trigger]")).not.toBeNull();
  });

  it("sets data-slots and merges className", async () => {
    await render(
      <Menubar aria-label="Bar" className="custom-bar">
        <Menu>
          <MenubarTrigger className="custom-trigger">File</MenubarTrigger>
          <MenuContent>
            <MenuItem>New</MenuItem>
          </MenuContent>
        </Menu>
      </Menubar>,
    );
    const bar = page.getByRole("menubar").element();
    expect(bar.getAttribute("data-slot")).toBe("menubar");
    expect(bar.classList.contains("custom-bar")).toBe(true);
    expect(bar.classList.contains("rounded-lg")).toBe(true);
    const file = trigger("File").element();
    expect(file.getAttribute("data-slot")).toBe("menubar-trigger");
    expect(file.classList.contains("custom-trigger")).toBe(true);
    expect(file.classList.contains("h-8")).toBe(true);
  });

  it("supports a function-form className on the bar and a trigger", async () => {
    await render(
      <Menubar aria-label="Bar" className={() => "fn-bar"}>
        <Menu>
          <MenubarTrigger className={(state) => (state.open ? "fn-open" : "fn-closed")}>
            File
          </MenubarTrigger>
          <MenuContent>
            <MenuItem>New</MenuItem>
          </MenuContent>
        </Menu>
      </Menubar>,
    );
    expect(page.getByRole("menubar").element().classList.contains("fn-bar")).toBe(true);
    expect(trigger("File").element().classList.contains("fn-closed")).toBe(true);
    await userEvent.click(trigger("File"));
    await expect.poll(() => trigger("File").element().classList.contains("fn-open")).toBe(true);
  });

  it("opens with click, Enter, Space and ArrowDown and runs an item", async () => {
    const onNew = vi.fn();
    await render(<AppMenubar onNew={onNew} />);
    await openByClick("File");
    await userEvent.click(item("New"));
    expect(onNew).toHaveBeenCalledTimes(1);
    await expect.poll(() => menus().length).toBe(0);

    for (const key of ["{Enter}", " ", "{ArrowDown}"]) {
      (trigger("File").element() as HTMLElement).focus();
      await userEvent.keyboard(key);
      await expect.element(item("New")).toBeVisible();
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => menus().length).toBe(0);
    }
  });

  it("moves between closed triggers with ArrowRight / ArrowLeft, looping, on one Tab stop", async () => {
    await render(
      <div>
        <button type="button">before</button>
        <AppMenubar />
        <button type="button">after</button>
      </div>,
    );
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger("File").element());
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(trigger("Edit").element());
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(document.activeElement).toBe(trigger("File").element());
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(trigger("View").element());
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("button", { name: "after" }).element());
  });

  it("switches to the neighbouring menu with ArrowRight / ArrowLeft while one is open", async () => {
    await render(<AppMenubar />);
    await openByClick("File");
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(item("Undo")).toBeVisible();
    await expect.element(trigger("Edit")).toHaveAttribute("aria-expanded", "true");
    await expect.element(trigger("File")).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(page.getByRole("menuitemcheckbox", { name: "Word wrap" })).toBeVisible();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    await expect.element(item("New")).toBeVisible();
    await expect.element(trigger("File")).toHaveAttribute("aria-expanded", "true");
  });

  it("switches menus on hover while one is open, but does not open one on hover alone", async () => {
    await render(<AppMenubar />);
    await userEvent.hover(trigger("Edit"));
    await expect.element(trigger("Edit")).toHaveAttribute("aria-expanded", "false");
    expect(menus().length).toBe(0);

    await openByClick("File");
    await userEvent.hover(trigger("Edit"));
    await expect.element(trigger("Edit")).toHaveAttribute("aria-expanded", "true");
    await expect.element(trigger("File")).toHaveAttribute("aria-expanded", "false");
    await expect.element(item("Undo")).toBeVisible();
  });

  it("Escape closes the open menu and returns focus to its trigger", async () => {
    await render(<AppMenubar />);
    (trigger("Edit").element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(item("Undo")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => menus().length).toBe(0);
    await expect.poll(() => document.activeElement).toBe(trigger("Edit").element());
  });

  it("Escape in a submenu closes only the submenu, then the menu", async () => {
    await render(<AppMenubar />);
    await openByClick("File");
    await userEvent.click(item("Export"));
    await expect.element(item("PDF")).toBeVisible();
    expect(menus().length).toBe(2);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => menus().length).toBe(1);
    await expect.element(item("New")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => menus().length).toBe(0);
    await expect.poll(() => document.activeElement).toBe(trigger("File").element());
  });

  it("Escape with a tooltip on the trigger closes the menu and returns focus", async () => {
    await render(
      <div className="p-16">
        <Menubar aria-label="Application">
          <Menu>
            <Tooltip>
              <TooltipTrigger delay={0} render={<MenubarTrigger>File</MenubarTrigger>} />
              <TooltipContent>File commands</TooltipContent>
            </Tooltip>
            <MenuContent>
              <MenuItem>New</MenuItem>
            </MenuContent>
          </Menu>
        </Menubar>
      </div>,
    );
    (trigger("File").element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(item("New")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => menus().length).toBe(0);
    await expect.poll(() => document.activeElement).toBe(trigger("File").element());
  });

  it("opens a submenu with ArrowRight and closes it with ArrowLeft", async () => {
    await render(<AppMenubar />);
    await openByClick("File");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowRight}");
    await expect.element(item("PDF")).toBeVisible();
    await userEvent.keyboard("{ArrowLeft}");
    await expect.poll(() => menus().length).toBe(1);
    await expect.element(trigger("File")).toHaveAttribute("aria-expanded", "true");
  });

  it("checkbox items toggle and keep the menu open", async () => {
    const onWrapChange = vi.fn();
    await render(<AppMenubar onWrapChange={onWrapChange} />);
    await openByClick("View");
    const wrap = page.getByRole("menuitemcheckbox", { name: "Word wrap" });
    await expect.element(wrap).toHaveAttribute("aria-checked", "true");
    await userEvent.click(wrap);
    await expect.element(wrap).toHaveAttribute("aria-checked", "false");
    expect(onWrapChange).toHaveBeenCalledWith(false, expect.anything());
    expect(menus().length).toBe(1);
  });

  it("supports a disabled trigger and orientation=vertical", async () => {
    await render(
      <Menubar aria-label="Side" orientation="vertical">
        <Menu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenuContent>
            <MenuItem>New</MenuItem>
          </MenuContent>
        </Menu>
        <Menu>
          <MenubarTrigger disabled>Help</MenubarTrigger>
          <MenuContent>
            <MenuItem>About</MenuItem>
          </MenuContent>
        </Menu>
      </Menubar>,
    );
    const bar = page.getByRole("menubar").element();
    expect(bar.getAttribute("aria-orientation")).toBe("vertical");
    expect(getComputedStyle(bar).flexDirection).toBe("column");
    await expect.element(trigger("Help")).toHaveAttribute("data-disabled");
  });

  it("uses a pointer cursor on triggers", async () => {
    await render(<AppMenubar />);
    expect(getComputedStyle(trigger("File").element()).cursor).toBe("pointer");
  });

  it("paints the open trigger with the muted surface", async () => {
    const screen = await render(
      <div>
        <AppMenubar />
        <div data-testid="ref" className="bg-muted" />
      </div>,
    );
    const reference = getComputedStyle(screen.getByTestId("ref").element()).backgroundColor;
    await openByClick("File");
    await expect
      .poll(() => getComputedStyle(trigger("File").element()).backgroundColor)
      .toBe(reference);
  });

  it("shows a visible 2px solid focus ring on Tab-focus", async () => {
    await render(<AppMenubar />);
    await userEvent.tab();
    const file = trigger("File").element();
    expect(document.activeElement).toBe(file);
    const style = getComputedStyle(file);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
  });

  it("forced colors: no outline until focused, then a Highlight ring; open trigger is legible", async () => {
    await emulateForcedColors(true);
    await render(<AppMenubar />);
    const file = trigger("File").element();
    expect(getComputedStyle(file).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(file);
    const focused = getComputedStyle(file);
    expect(focused.outlineStyle).toBe("solid");
    expect(focused.outlineColor).toBe(systemColor("Highlight"));

    await openByClick("File");
    const open = getComputedStyle(file);
    await expect.poll(() => getComputedStyle(file).backgroundColor).toBe(systemColor("Highlight"));
    expect(open.color).toBe(systemColor("HighlightText"));
    expect(open.forcedColorAdjust).toBe("none");
  });

  describe.each(["light", "dark"] as const)("axe (%s)", (theme) => {
    it("has no violations closed", async () => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(
        <div className="bg-background">
          <AppMenubar />
        </div>,
      );
      const { violations, incomplete } = await auditOpenOverlay();
      expect(violations).toEqual([]);
      expect(incomplete).toEqual([]);
    });

    it("has no violations with a menu and a submenu open", async () => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(
        <div className="bg-background">
          <AppMenubar />
        </div>,
      );
      await openByClick("File");
      await userEvent.click(item("Export"));
      await expect.element(item("PDF")).toBeVisible();
      await waitForPopupSettled(menus()[1] as HTMLElement);
      const { violations, incomplete } = await auditOpenOverlay();
      expect(violations).toEqual([]);
      expect(incomplete).toEqual([]);
    });
  });
});
