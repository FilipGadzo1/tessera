import type { Meta, StoryObj } from "@storybook/react-vite";
import { Check, Clock, X } from "lucide-react";
import { Badge } from "./badge";

const variants = ["solid", "soft", "outline"] as const;
const colors = ["primary", "neutral", "success", "warning", "danger", "info"] as const;
const sizes = ["sm", "md"] as const;

const meta = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: { children: "Badge" },
  argTypes: {
    variant: { control: "select", options: variants },
    color: { control: "select", options: colors },
    size: { control: "select", options: sizes },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Matrix: Story = {
  render: (args) => (
    <div className="grid grid-cols-[auto_repeat(3,max-content)] items-center gap-3">
      <span />
      {variants.map((variant) => (
        <span key={variant} className="text-muted-foreground text-xs">
          {variant}
        </span>
      ))}
      {colors.map((color) => [
        <span key={color} className="text-muted-foreground text-xs">
          {color}
        </span>,
        ...variants.map((variant) => (
          <Badge key={`${color}-${variant}`} {...args} variant={variant} color={color}>
            {color}
          </Badge>
        )),
      ])}
    </div>
  ),
};

export const WithIcon: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge {...args} color="success">
        <Check /> Paid
      </Badge>
      <Badge {...args} color="warning">
        <Clock /> Pending
      </Badge>
      <Badge {...args} color="danger" variant="solid">
        <X /> Failed
      </Badge>
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {sizes.map((size) => (
        <Badge key={size} {...args} size={size}>
          Size {size}
        </Badge>
      ))}
    </div>
  ),
};
