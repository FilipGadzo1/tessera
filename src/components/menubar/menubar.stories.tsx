import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
} from "../menu";
import { Menubar, MenubarTrigger } from "./menubar";

const meta = {
  title: "Components/Menubar",
  component: Menubar,
  tags: ["autodocs"],
  args: { "aria-label": "Application" },
} satisfies Meta<typeof Menubar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A `Menu` around each `MenubarTrigger` + `MenuContent` pair. The items are the ordinary Menu
 * parts, unchanged. Left/Right move between triggers; with a menu open they switch to the
 * neighbouring menu, and hovering another trigger switches too.
 */
export const ApplicationMenubar: Story = {
  render: (args) => (
    <Menubar {...args}>
      <Menu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenuContent>
          <MenuItem>
            New
            <MenuShortcut shortcut="mod+n" />
          </MenuItem>
          <MenuItem>
            Open…
            <MenuShortcut shortcut="mod+o" />
          </MenuItem>
          <MenuItem>
            Save
            <MenuShortcut shortcut="mod+s" />
          </MenuItem>
          <MenuSeparator />
          <MenuItem variant="danger">Close window</MenuItem>
        </MenuContent>
      </Menu>
      <Menu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenuContent>
          <MenuItem>
            Undo
            <MenuShortcut shortcut="mod+z" />
          </MenuItem>
          <MenuItem>
            Redo
            <MenuShortcut shortcut="mod+shift+z" />
          </MenuItem>
          <MenuSeparator />
          <MenuItem>Cut</MenuItem>
          <MenuItem>Copy</MenuItem>
          <MenuItem>Paste</MenuItem>
        </MenuContent>
      </Menu>
      <Menu>
        <MenubarTrigger>Help</MenubarTrigger>
        <MenuContent>
          <MenuItem>Documentation</MenuItem>
          <MenuItem>About</MenuItem>
        </MenuContent>
      </Menu>
    </Menubar>
  ),
};

/** Submenus (`MenuSub*`), checkbox items and radio items work inside a menubar as in a `Menu`. */
export const WithSubmenusAndCheckboxItems: Story = {
  render: function Render(args) {
    const [toolbar, setToolbar] = useState(true);
    const [wrap, setWrap] = useState(false);
    const [zoom, setZoom] = useState("100");
    return (
      <Menubar {...args}>
        <Menu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenuContent>
            <MenuItem>New</MenuItem>
            <MenuItem>Open…</MenuItem>
            <MenuSeparator />
            <MenuSub>
              <MenuSubTrigger>Export</MenuSubTrigger>
              <MenuSubContent>
                <MenuItem>PDF</MenuItem>
                <MenuItem>PNG</MenuItem>
                <MenuItem>SVG</MenuItem>
              </MenuSubContent>
            </MenuSub>
          </MenuContent>
        </Menu>
        <Menu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenuContent>
            <MenuCheckboxItem checked={toolbar} onCheckedChange={setToolbar}>
              Show toolbar
            </MenuCheckboxItem>
            <MenuCheckboxItem checked={wrap} onCheckedChange={setWrap}>
              Word wrap
            </MenuCheckboxItem>
            <MenuSeparator />
            <MenuRadioGroup value={zoom} onValueChange={setZoom}>
              <MenuRadioItem value="75">75%</MenuRadioItem>
              <MenuRadioItem value="100">100%</MenuRadioItem>
              <MenuRadioItem value="150">150%</MenuRadioItem>
            </MenuRadioGroup>
          </MenuContent>
        </Menu>
        <Menu>
          <MenubarTrigger disabled>Window</MenubarTrigger>
          <MenuContent>
            <MenuItem>Minimize</MenuItem>
          </MenuContent>
        </Menu>
      </Menubar>
    );
  },
};

/** `orientation="vertical"` stacks the triggers and switches the arrow keys to Up/Down. */
export const Vertical: Story = {
  args: { orientation: "vertical", className: "w-40" },
  render: (args) => (
    <Menubar {...args}>
      <Menu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenuContent side="right" align="start" sideOffset={8}>
          <MenuItem>New</MenuItem>
          <MenuItem>Open…</MenuItem>
        </MenuContent>
      </Menu>
      <Menu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenuContent side="right" align="start" sideOffset={8}>
          <MenuItem>Undo</MenuItem>
          <MenuItem>Redo</MenuItem>
        </MenuContent>
      </Menu>
    </Menubar>
  ),
};
