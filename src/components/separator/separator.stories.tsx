import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bold, Italic, Link, List, ListOrdered, Underline } from "lucide-react";
import { Button } from "../button";
import { Separator } from "./separator";

const meta = {
  title: "Components/Separator",
  component: Separator,
  tags: ["autodocs"],
  argTypes: {
    orientation: { control: "inline-radio", options: ["horizontal", "vertical"] },
    decorative: { control: "boolean" },
  },
  args: { orientation: "horizontal", decorative: true },
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div
      className={
        args.orientation === "vertical" ? "flex h-8 items-center gap-3 text-sm" : "w-72 text-sm"
      }
    >
      <span>Before</span>
      <Separator {...args} className={args.orientation === "vertical" ? undefined : "my-3"} />
      <span>After</span>
    </div>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <div className="w-80 text-sm">
      <div className="space-y-1">
        <h4 className="font-medium">Tessera</h4>
        <p className="text-muted-foreground">Every component a tile; every project a mosaic.</p>
      </div>
      <Separator className="my-4" />
      <div className="flex h-5 items-center gap-4">
        <span>Docs</span>
        <Separator orientation="vertical" />
        <span>Components</span>
        <Separator orientation="vertical" />
        <span>Changelog</span>
      </div>
    </div>
  ),
};

export const InAToolbar: Story = {
  render: () => (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex w-fit items-center gap-1 rounded-md border border-border p-1"
    >
      <Button variant="ghost" size="icon-sm" aria-label="Bold">
        <Bold />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Italic">
        <Italic />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Underline">
        <Underline />
      </Button>
      <Separator orientation="vertical" decorative={false} className="mx-1" />
      <Button variant="ghost" size="icon-sm" aria-label="Bulleted list">
        <List />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Numbered list">
        <ListOrdered />
      </Button>
      <Separator orientation="vertical" decorative={false} className="mx-1" />
      <Button variant="ghost" size="icon-sm" aria-label="Insert link">
        <Link />
      </Button>
    </div>
  ),
};
