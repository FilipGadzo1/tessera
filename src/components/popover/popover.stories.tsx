import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../button";
import { Input } from "../input";
import { Label } from "../label";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "./popover";

const meta = {
  title: "Components/Popover",
  component: PopoverContent,
  tags: ["autodocs"],
  args: { side: "bottom", align: "center", sideOffset: 6 },
  argTypes: {
    side: { control: "select", options: ["top", "right", "bottom", "left"] },
    align: { control: "select", options: ["start", "center", "end"] },
    sideOffset: { control: "number" },
  },
  render: (args) => (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>Open popover</PopoverTrigger>
      <PopoverContent {...args}>
        <PopoverTitle>About this layer</PopoverTitle>
        <PopoverDescription>
          Layers stack in the order they were added. Drag them in the sidebar to reorder.
        </PopoverDescription>
      </PopoverContent>
    </Popover>
  ),
} satisfies Meta<typeof PopoverContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Click (or Enter/Space) opens it; Escape, an outside click or `PopoverClose` closes it and focus
 * returns to the trigger. The trigger is composed with Tessera `Button` via `render`.
 */
export const Default: Story = {};

/** A small form: focus moves to the first input on open. */
export const WithForm: Story = {
  render: (args) => (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>Dimensions</PopoverTrigger>
      <PopoverContent {...args}>
        <PopoverTitle>Dimensions</PopoverTitle>
        <PopoverDescription>Set the size of the selected layer.</PopoverDescription>
        <div className="grid grid-cols-[4rem_1fr] items-center gap-x-3 gap-y-2 pt-2">
          <Label htmlFor="popover-width">Width</Label>
          <Input id="popover-width" defaultValue="100%" />
          <Label htmlFor="popover-height">Height</Label>
          <Input id="popover-height" defaultValue="25px" />
        </div>
        <PopoverClose render={<Button size="sm" className="mt-2 self-end" />}>Done</PopoverClose>
      </PopoverContent>
    </Popover>
  ),
};

/** `side` places the popover; it flips when there is no room. */
export const Sides: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 p-24">
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <Popover key={side}>
          <PopoverTrigger render={<Button variant="outline" />}>{side}</PopoverTrigger>
          <PopoverContent side={side} className="w-56">
            <PopoverTitle>Popover on the {side}</PopoverTitle>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  ),
};

/** Controlled with `open` / `onOpenChange`; an external button can close it too. */
export const Controlled: Story = {
  render: function ControlledPopover(args) {
    const [open, setOpen] = useState(false);
    return (
      <div className="flex items-center gap-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<Button variant="outline" />}>Notifications</PopoverTrigger>
          <PopoverContent {...args}>
            <PopoverTitle>Notifications</PopoverTitle>
            <PopoverDescription>You are all caught up.</PopoverDescription>
            <PopoverClose render={<Button size="sm" variant="ghost" className="self-end" />}>
              Close
            </PopoverClose>
          </PopoverContent>
        </Popover>
        <span className="text-sm text-muted-foreground">{open ? "Open" : "Closed"}</span>
      </div>
    );
  },
};
