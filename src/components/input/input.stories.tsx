import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../button";
import { Label } from "../label";
import { Input } from "./input";

const sizes = ["sm", "md", "lg"] as const;

const meta = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
  args: { placeholder: "you@example.com", "aria-label": "Email" },
  argTypes: {
    size: { control: "select", options: sizes },
    disabled: { control: "boolean" },
    readOnly: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Each Input height matches the Button of the same size. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {sizes.map((size) => (
        <div key={size} className="flex items-center gap-2">
          <Input
            {...args}
            size={size}
            aria-label={`Search (${size})`}
            placeholder={`Size ${size}`}
          />
          <Button size={size}>Search</Button>
        </div>
      ))}
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="state-default">Default</Label>
        <Input id="state-default" defaultValue="Ada Lovelace" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="state-placeholder">Placeholder</Label>
        <Input id="state-placeholder" placeholder="you@example.com" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="state-disabled">Disabled</Label>
        <Input id="state-disabled" disabled defaultValue="Locked" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="state-readonly">Read-only</Label>
        <Input id="state-readonly" readOnly defaultValue="INV-2041" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="state-invalid">Invalid</Label>
        <Input id="state-invalid" aria-invalid="true" defaultValue="not-an-email" />
      </div>
    </div>
  ),
};
