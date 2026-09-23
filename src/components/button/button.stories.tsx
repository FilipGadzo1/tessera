import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { fn } from "storybook/test";
import { Button } from "./button";
import { buttonVariants } from "./button-variants";

const variants = ["solid", "soft", "outline", "ghost", "link"] as const;
const colors = ["primary", "neutral", "success", "warning", "danger", "info"] as const;
const sizes = ["xs", "sm", "md", "lg"] as const;

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Button", onClick: fn() },
  argTypes: {
    variant: { control: "select", options: variants },
    color: { control: "select", options: colors },
    size: {
      control: "select",
      options: [...sizes, "icon-xs", "icon-sm", "icon", "icon-lg"],
    },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Matrix: Story = {
  render: (args) => (
    <div className="grid grid-cols-[auto_repeat(5,max-content)] items-center gap-3">
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
          <Button key={`${color}-${variant}`} {...args} variant={variant} color={color}>
            Save
          </Button>
        )),
      ])}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {sizes.map((size) => (
        <Button key={size} {...args} size={size}>
          Size {size}
        </Button>
      ))}
    </div>
  ),
};

export const WithIcons: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} variant="solid" color="primary">
        <Plus /> New project
      </Button>
      <Button {...args} variant="outline" color="neutral">
        Continue <ArrowRight />
      </Button>
      <Button {...args} variant="soft" color="danger">
        <Trash2 /> Delete
      </Button>
    </div>
  ),
};

export const IconOnly: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="icon-xs" aria-label="Add">
        <Plus />
      </Button>
      <Button {...args} size="icon-sm" aria-label="Add">
        <Plus />
      </Button>
      <Button {...args} size="icon" aria-label="Add">
        <Plus />
      </Button>
      <Button {...args} size="icon-lg" aria-label="Add">
        <Plus />
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  args: { loading: true, children: "Saving…" },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const AsLink: Story = {
  render: () => (
    <a href="#docs" className={buttonVariants({ variant: "outline", color: "neutral" })}>
      Read the docs <ArrowRight />
    </a>
  ),
};
