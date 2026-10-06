import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../button";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
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

const meta = {
  title: "Components/Menu",
  component: MenuContent,
  tags: ["autodocs"],
  args: { side: "bottom", align: "start", sideOffset: 6 },
  argTypes: {
    side: { control: "select", options: ["top", "right", "bottom", "left"] },
    align: { control: "select", options: ["start", "center", "end"] },
    sideOffset: { control: "number" },
  },
  render: (args) => (
    <Menu>
      <MenuTrigger render={<Button variant="outline" />}>Project actions</MenuTrigger>
      <MenuContent {...args}>
        <MenuItem>
          Edit
          <MenuShortcut shortcut="mod+e" />
        </MenuItem>
        <MenuItem>
          Duplicate
          <MenuShortcut shortcut="mod+d" />
        </MenuItem>
        <MenuSeparator />
        <MenuItem>Archive</MenuItem>
        <MenuItem variant="danger">Delete</MenuItem>
      </MenuContent>
    </Menu>
  ),
} satisfies Meta<typeof MenuContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Click, Enter, Space or ArrowDown opens it. The arrow keys move the highlight, Enter activates an
 * item and closes the menu, Escape closes it; focus returns to the trigger. `variant="danger"`
 * marks a destructive action.
 */
export const Default: Story = {};

/** Checkbox items toggle and keep the menu open. */
export const WithCheckboxItems: Story = {
  render: function Render(args) {
    const [grid, setGrid] = useState(true);
    const [rulers, setRulers] = useState(false);
    const [guides, setGuides] = useState(true);
    return (
      <Menu>
        <MenuTrigger render={<Button variant="outline" />}>View</MenuTrigger>
        <MenuContent {...args}>
          <MenuGroup>
            <MenuGroupLabel>View options</MenuGroupLabel>
            <MenuCheckboxItem checked={grid} onCheckedChange={setGrid}>
              Show grid
            </MenuCheckboxItem>
            <MenuCheckboxItem checked={rulers} onCheckedChange={setRulers}>
              Show rulers
            </MenuCheckboxItem>
            <MenuCheckboxItem checked={guides} onCheckedChange={setGuides}>
              Show guides
            </MenuCheckboxItem>
          </MenuGroup>
        </MenuContent>
      </Menu>
    );
  },
};

/** A radio group selects one value; the menu stays open. */
export const WithRadioGroup: Story = {
  render: function Render(args) {
    const [sort, setSort] = useState("updated");
    return (
      <Menu>
        <MenuTrigger render={<Button variant="outline" />}>Sort</MenuTrigger>
        <MenuContent {...args}>
          <MenuGroup>
            <MenuGroupLabel>Sort by</MenuGroupLabel>
            <MenuRadioGroup value={sort} onValueChange={setSort}>
              <MenuRadioItem value="name">Name</MenuRadioItem>
              <MenuRadioItem value="created">Date created</MenuRadioItem>
              <MenuRadioItem value="updated">Last updated</MenuRadioItem>
            </MenuRadioGroup>
          </MenuGroup>
        </MenuContent>
      </Menu>
    );
  },
};

/** A submenu opens on hover, click or ArrowRight; ArrowLeft closes it. */
export const WithSubmenu: Story = {
  render: (args) => (
    <Menu>
      <MenuTrigger render={<Button variant="outline" />}>File</MenuTrigger>
      <MenuContent {...args}>
        <MenuItem>
          New file
          <MenuShortcut shortcut="mod+n" />
        </MenuItem>
        <MenuItem>Open…</MenuItem>
        <MenuSeparator />
        <MenuSub>
          <MenuSubTrigger>Share</MenuSubTrigger>
          <MenuSubContent>
            <MenuItem>Email</MenuItem>
            <MenuItem>Copy link</MenuItem>
          </MenuSubContent>
        </MenuSub>
      </MenuContent>
    </Menu>
  ),
};
