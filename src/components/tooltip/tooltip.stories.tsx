import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bold, Italic, Plus, Underline } from "lucide-react";
import { Button } from "../button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

const meta = {
  title: "Components/Tooltip",
  component: TooltipContent,
  tags: ["autodocs"],
  args: { side: "top", sideOffset: 6, children: "Save your changes" },
  argTypes: {
    side: { control: "select", options: ["top", "right", "bottom", "left"] },
    align: { control: "select", options: ["start", "center", "end"] },
    sideOffset: { control: "number" },
  },
  render: (args) => (
    <Tooltip>
      <TooltipTrigger render={<Button variant="outline" />}>Save</TooltipTrigger>
      <TooltipContent {...args} />
    </Tooltip>
  ),
} satisfies Meta<typeof TooltipContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Hover or Tab to the button. The trigger is composed with Tessera `Button` via `render`. */
export const Default: Story = {};

/** An icon-only button: `aria-label` names it, the tooltip describes it. */
export const IconButton: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger
        render={<Button size="icon" variant="ghost" color="neutral" aria-label="Add" />}
      >
        <Plus aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>Add item</TooltipContent>
    </Tooltip>
  ),
};

/** `side` places the tooltip; it flips when there is no room. */
export const Sides: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 p-12">
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <Tooltip key={side}>
          <TooltipTrigger render={<Button variant="outline" />}>{side}</TooltipTrigger>
          <TooltipContent side={side}>Tooltip on the {side}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  ),
};

/**
 * `TooltipProvider` shares the delay: once one tooltip is open, moving to a neighbour opens its
 * tooltip instantly.
 */
export const WithProvider: Story = {
  render: () => (
    <TooltipProvider delay={400}>
      <div className="flex gap-1">
        {[
          { label: "Bold", Icon: Bold },
          { label: "Italic", Icon: Italic },
          { label: "Underline", Icon: Underline },
        ].map(({ label, Icon }) => (
          <Tooltip key={label}>
            <TooltipTrigger
              render={<Button size="icon-sm" variant="ghost" color="neutral" aria-label={label} />}
            >
              <Icon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  ),
};
