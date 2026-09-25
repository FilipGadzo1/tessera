import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../menu/menu";
import { ToggleGroup, ToggleGroupItem } from "../toggle/toggle";
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarInput,
  ToolbarLink,
  ToolbarSeparator,
} from "./toolbar";

function Editor() {
  return (
    <Toolbar aria-label="Text formatting">
      <ToggleGroup aria-label="Formatting" multiple>
        <ToggleGroupItem value="bold" aria-label="Bold">
          B
        </ToggleGroupItem>
        <ToggleGroupItem value="italic" aria-label="Italic">
          I
        </ToggleGroupItem>
      </ToggleGroup>
      <ToolbarSeparator />
      <ToolbarGroup aria-label="Actions">
        <ToolbarButton aria-label="Undo">Undo</ToolbarButton>
      </ToolbarGroup>
      <Menu>
        <ToolbarButton render={<MenuTrigger />}>Insert</ToolbarButton>
        <MenuContent>
          <MenuItem>Image</MenuItem>
          <MenuItem>Link</MenuItem>
        </MenuContent>
      </Menu>
      <ToolbarLink href="#">Edited 51m ago</ToolbarLink>
    </Toolbar>
  );
}

describe("Toolbar", () => {
  it("is a named toolbar with data-slot on every part", async () => {
    const screen = await render(<Editor />);
    const toolbar = screen.getByRole("toolbar", { name: "Text formatting" });
    await expect.element(toolbar).toHaveAttribute("data-slot", "toolbar");
    await expect
      .element(screen.getByRole("button", { name: "Undo" }))
      .toHaveAttribute("data-slot", "toolbar-button");
    await expect
      .element(screen.getByRole("link", { name: "Edited 51m ago" }))
      .toHaveAttribute("data-slot", "toolbar-link");
    const separator = toolbar.element().querySelector('[data-slot="toolbar-separator"]');
    expect(separator).not.toBeNull();
    expect(separator?.getAttribute("role")).toBe("separator");
  });

  it("merges className on the root", async () => {
    const screen = await render(
      <Toolbar aria-label="Simple" className="max-w-md">
        <ToolbarButton>A</ToolbarButton>
      </Toolbar>,
    );
    await expect.element(screen.getByRole("toolbar")).toHaveClass("max-w-md");
  });

  it("keeps a single Tab stop and arrows cross a Button, a nested ToggleGroup and a Link", async () => {
    const screen = await render(<Editor />);
    const bold = screen.getByRole("button", { name: "Bold" }).element() as HTMLElement;
    const italic = screen.getByRole("button", { name: "Italic" }).element();
    const undo = screen.getByRole("button", { name: "Undo" }).element();
    const insert = screen.getByRole("button", { name: "Insert" }).element();
    const link = screen.getByRole("link", { name: "Edited 51m ago" }).element();

    bold.focus();
    expect(document.activeElement).toBe(bold);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(italic);
    // Crosses out of the nested ToggleGroup into the next ToolbarGroup's button.
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(undo);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(insert);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(link);
    // A single Tab stop: Tab leaves the toolbar entirely.
    await userEvent.tab();
    expect(document.activeElement).not.toBe(bold);
    expect(document.activeElement).not.toBe(italic);
    expect(document.activeElement).not.toBe(undo);
    expect(document.activeElement).not.toBe(insert);
    expect(document.activeElement).not.toBe(link);
  });

  it("uses ↑/↓ arrows when the toolbar is vertical", async () => {
    const screen = await render(
      <Toolbar aria-label="Vertical" orientation="vertical">
        <ToolbarButton aria-label="First">1</ToolbarButton>
        <ToolbarButton aria-label="Second">2</ToolbarButton>
      </Toolbar>,
    );
    const first = screen.getByRole("button", { name: "First" }).element() as HTMLElement;
    const second = screen.getByRole("button", { name: "Second" }).element();
    first.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(second);
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(first);
  });

  it("opens a Menu composed via render={<MenuTrigger />} on ToolbarButton", async () => {
    const screen = await render(<Editor />);
    const insert = screen.getByRole("button", { name: "Insert" });
    await expect.element(insert).toHaveAttribute("data-slot", "toolbar-button");
    await insert.click();
    await expect.element(screen.getByRole("menuitem", { name: "Image" })).toBeInTheDocument();
  });

  it("renders a vertical separator (role=separator) in a horizontal toolbar and a horizontal one in a vertical toolbar", async () => {
    const horizontal = await render(
      <Toolbar aria-label="H">
        <ToolbarButton>A</ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton>B</ToolbarButton>
      </Toolbar>,
    );
    const hSep = horizontal.container.querySelector('[data-slot="toolbar-separator"]');
    expect(hSep?.getAttribute("data-orientation")).toBe("vertical");
    expect(getComputedStyle(hSep as Element).width).toBe("1px");

    const vertical = await render(
      <Toolbar aria-label="V" orientation="vertical">
        <ToolbarButton>A</ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton>B</ToolbarButton>
      </Toolbar>,
    );
    const vSep = vertical.container.querySelector('[data-slot="toolbar-separator"]');
    expect(vSep?.getAttribute("data-orientation")).toBe("horizontal");
    expect(getComputedStyle(vSep as Element).height).toBe("1px");
  });

  it("keeps ←/→ for the ToolbarInput's caret and Tab leaves it", async () => {
    const screen = await render(
      <Toolbar aria-label="With input">
        <ToolbarButton aria-label="Before">B</ToolbarButton>
        <ToolbarInput aria-label="Font size" defaultValue="12" className="w-16" />
      </Toolbar>,
    );
    const input = screen.getByRole("textbox", { name: "Font size" }).element() as HTMLInputElement;
    await expect.element(input).toHaveAttribute("data-slot", "toolbar-input");
    input.focus();
    input.setSelectionRange(2, 2);
    await userEvent.keyboard("{ArrowLeft}");
    expect(input.selectionStart).toBe(1);
    await userEvent.tab();
    expect(document.activeElement).not.toBe(input);
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Editor />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
