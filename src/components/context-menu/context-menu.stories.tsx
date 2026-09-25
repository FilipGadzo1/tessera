import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  MenuCheckboxItem,
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
} from "../menu";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "./context-menu";

const meta = {
  title: "Components/ContextMenu",
  component: ContextMenuContent,
  tags: ["autodocs"],
  render: (args) => (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-32 w-64 select-none items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        Right-click this area
      </ContextMenuTrigger>
      <ContextMenuContent {...args}>
        <MenuItem>
          Back
          <MenuShortcut>⌥←</MenuShortcut>
        </MenuItem>
        <MenuItem>Reload</MenuItem>
        <MenuSeparator />
        <MenuItem>Save as…</MenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
} satisfies Meta<typeof ContextMenuContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Right-click (or long-press on touch) opens it, positioned at the pointer. It reuses the Menu
 * item parts unchanged: `MenuItem`, `MenuCheckboxItem`, `MenuRadioGroup`/`MenuRadioItem`,
 * `MenuGroup`/`MenuGroupLabel`, `MenuSeparator` and `MenuSub*`.
 */
export const Basic: Story = {};

/** Checkbox and radio items work inside a context menu exactly as they do inside `Menu`. */
export const WithCheckboxAndRadioItems: Story = {
  render: function Render(args) {
    const [showHidden, setShowHidden] = useState(false);
    const [sort, setSort] = useState("name");
    return (
      <ContextMenu>
        <ContextMenuTrigger className="flex h-32 w-64 select-none items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
          Right-click this area
        </ContextMenuTrigger>
        <ContextMenuContent {...args}>
          <MenuCheckboxItem checked={showHidden} onCheckedChange={setShowHidden}>
            Show hidden files
          </MenuCheckboxItem>
          <MenuSeparator />
          <MenuGroup>
            <MenuGroupLabel>Sort by</MenuGroupLabel>
            <MenuRadioGroup value={sort} onValueChange={setSort}>
              <MenuRadioItem value="name">Name</MenuRadioItem>
              <MenuRadioItem value="date">Date modified</MenuRadioItem>
              <MenuRadioItem value="size">Size</MenuRadioItem>
            </MenuRadioGroup>
          </MenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    );
  },
};

/** A submenu opens on hover, click or ArrowRight, reusing `MenuSub` from Menu. */
export const WithSubmenu: Story = {
  render: (args) => (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-32 w-64 select-none items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        Right-click this area
      </ContextMenuTrigger>
      <ContextMenuContent {...args}>
        <MenuItem>Inspect</MenuItem>
        <MenuSub>
          <MenuSubTrigger>More tools</MenuSubTrigger>
          <MenuSubContent>
            <MenuItem>Developer tools</MenuItem>
            <MenuItem>Task manager</MenuItem>
          </MenuSubContent>
        </MenuSub>
      </ContextMenuContent>
    </ContextMenu>
  ),
};

/** `<MenuItem variant="danger">` marks a destructive action, same as in `Menu`. */
export const DangerItem: Story = {
  render: (args) => (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-32 w-64 select-none items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        Right-click this row
      </ContextMenuTrigger>
      <ContextMenuContent {...args}>
        <MenuItem>Rename…</MenuItem>
        <MenuItem>Duplicate</MenuItem>
        <MenuSeparator />
        <MenuItem variant="danger">Delete</MenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
};
