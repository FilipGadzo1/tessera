import type { Meta, StoryObj } from "@storybook/react-vite";
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

const meta = {
  title: "Components/Toolbar",
  component: Toolbar,
  tags: ["autodocs"],
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextFormatting: Story = {
  name: "Text formatting",
  render: () => (
    <Toolbar aria-label="Text formatting" className="w-fit">
      <ToggleGroup aria-label="Formatting" multiple defaultValue={["bold"]}>
        <ToggleGroupItem value="bold" aria-label="Bold" size="icon-sm">
          B
        </ToggleGroupItem>
        <ToggleGroupItem value="italic" aria-label="Italic" size="icon-sm">
          I
        </ToggleGroupItem>
        <ToggleGroupItem value="underline" aria-label="Underline" size="icon-sm">
          U
        </ToggleGroupItem>
      </ToggleGroup>
      <ToolbarSeparator />
      <ToggleGroup aria-label="Alignment" defaultValue={["left"]}>
        <ToggleGroupItem value="left" aria-label="Align left" size="icon-sm">
          L
        </ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="Align center" size="icon-sm">
          C
        </ToggleGroupItem>
        <ToggleGroupItem value="right" aria-label="Align right" size="icon-sm">
          R
        </ToggleGroupItem>
      </ToggleGroup>
      <ToolbarSeparator />
      <Menu>
        <ToolbarButton render={<MenuTrigger />}>Insert</ToolbarButton>
        <MenuContent>
          <MenuItem>Image</MenuItem>
          <MenuItem>Link</MenuItem>
          <MenuItem>Table</MenuItem>
        </MenuContent>
      </Menu>
    </Toolbar>
  ),
};

export const WithInputAndLink: Story = {
  name: "With input and link",
  render: () => (
    <Toolbar aria-label="Document toolbar" className="w-fit">
      <ToolbarGroup aria-label="History">
        <ToolbarButton aria-label="Undo">Undo</ToolbarButton>
        <ToolbarButton aria-label="Redo">Redo</ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarInput aria-label="Font size" defaultValue="12" className="w-16" />
      <ToolbarSeparator />
      <ToolbarLink href="#" className="ml-auto">
        Edited 51m ago
      </ToolbarLink>
    </Toolbar>
  ),
};

export const Vertical: Story = {
  render: () => (
    <Toolbar aria-label="Vertical toolbar" orientation="vertical" className="w-fit">
      <ToggleGroup
        aria-label="Alignment"
        variant="outline"
        orientation="vertical"
        defaultValue={["left"]}
      >
        <ToggleGroupItem value="left" aria-label="Align left" size="icon-sm">
          L
        </ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="Align center" size="icon-sm">
          C
        </ToggleGroupItem>
        <ToggleGroupItem value="right" aria-label="Align right" size="icon-sm">
          R
        </ToggleGroupItem>
      </ToggleGroup>
      <ToolbarSeparator />
      <ToolbarButton aria-label="More">More</ToolbarButton>
    </Toolbar>
  ),
};
