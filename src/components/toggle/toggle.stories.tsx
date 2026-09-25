import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import { Toggle, ToggleGroup, ToggleGroupItem } from "./toggle";

const sizes = ["sm", "md", "lg"] as const;

function BoldIcon(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M3.73 2.13a.53.53 0 0 0 0 1.07h.53v9.6h-.53a.53.53 0 0 0 0 1.07h6.13c1.91 0 3.47-1.56 3.47-3.47 0-1.4-.84-2.61-2.04-3.16.6-.54.97-1.31.97-2.17 0-1.62-1.31-2.94-2.93-2.94H3.73Zm3.2 1.07h1.33c1.03 0 1.87.84 1.87 1.87s-.84 1.86-1.87 1.86H6.93V3.2Zm0 4.8h.8.53c1.33 0 2.4 1.08 2.4 2.4s-1.07 2.4-2.4 2.4H6.93V8Z" />
    </svg>
  );
}

function ItalicIcon(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M6.93 2.13a.53.53 0 0 0 0 1.07h.77l-1 9.6h-.83a.53.53 0 0 0 0 1.07h3.2a.53.53 0 0 0 0-1.07h-.77l1-9.6h.77a.53.53 0 0 0 0-1.07h-3.14Z" />
    </svg>
  );
}

function UnderlineIcon(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M3.73 2.13a.53.53 0 0 0 0 1.07v4.8c0 2.22 1.82 4.27 4.27 4.27s4.27-2.05 4.27-4.27v-4.8a.53.53 0 0 0 0-1.07h-2.13a.53.53 0 0 0 0 1.07v5.72c0 1.11-.81 2.11-1.92 2.22-1.27.12-2.35-.89-2.35-2.14V3.2a.53.53 0 0 0 0-1.07H3.73ZM3.73 13.33a.53.53 0 0 0 0 1.07h8.53a.53.53 0 0 0 0-1.07H3.73Z" />
    </svg>
  );
}

const meta = {
  title: "Components/Toggle",
  component: Toggle,
  tags: ["autodocs"],
  args: { "aria-label": "Bold" },
  argTypes: {
    variant: { control: "inline-radio", options: ["ghost", "outline"] },
    size: { control: "inline-radio", options: [...sizes, "icon-sm", "icon", "icon-lg"] },
  },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Toggle {...args}>
      <BoldIcon className="size-4" />
      Bold
    </Toggle>
  ),
};

export const Outline: Story = {
  render: () => (
    <div className="flex gap-2">
      <Toggle variant="outline" aria-label="Bold">
        Bold
      </Toggle>
      <Toggle variant="outline" aria-label="Italic" defaultPressed>
        Italic
      </Toggle>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      {sizes.map((size) => (
        <Toggle key={size} size={size} aria-label={`Bold, size ${size}`}>
          Bold
        </Toggle>
      ))}
    </div>
  ),
};

export const IconWithLabel: Story = {
  name: "Icon with label",
  render: () => (
    <Toggle size="icon" aria-label="Bold">
      <BoldIcon />
    </Toggle>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex gap-2">
      <Toggle aria-label="Bold" disabled>
        Bold
      </Toggle>
      <Toggle aria-label="Italic" disabled defaultPressed>
        Italic
      </Toggle>
    </div>
  ),
};

// ToggleGroup — Toggle and ToggleGroup share a Storybook title ("Components/Toggle") because
// ToggleGroupItem always renders a Toggle (see toggle.tsx); a second exported `meta` with title
// "Components/ToggleGroup" would duplicate the same `component`/args wiring for no benefit, and
// Storybook's own docs group stories only by `title`, not by which named export a story belongs
// to. Recorded per the brief's resolved ambiguity.

export const ToggleGroupSingle: Story = {
  name: "ToggleGroup / Single",
  render: () => (
    <ToggleGroup aria-label="Text alignment" defaultValue={["left"]}>
      <ToggleGroupItem value="left" aria-label="Align left" size="icon">
        L
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="Align center" size="icon">
        C
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="Align right" size="icon">
        R
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const ToggleGroupMultiple: Story = {
  name: "ToggleGroup / Multiple",
  render: () => (
    <ToggleGroup aria-label="Text formatting" multiple defaultValue={["bold"]}>
      <ToggleGroupItem value="bold" aria-label="Bold" size="icon">
        <BoldIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic" size="icon">
        <ItalicIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline" size="icon">
        <UnderlineIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const ToggleGroupOutlineAttached: Story = {
  name: "ToggleGroup / Outline attached",
  render: () => (
    <ToggleGroup aria-label="Text alignment" variant="outline" defaultValue={["left"]}>
      <ToggleGroupItem value="left" aria-label="Align left" size="icon">
        L
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="Align center" size="icon">
        C
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="Align right" size="icon">
        R
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const ToggleGroupVertical: Story = {
  name: "ToggleGroup / Vertical",
  render: () => (
    <ToggleGroup
      aria-label="Text alignment"
      variant="outline"
      orientation="vertical"
      defaultValue={["left"]}
    >
      <ToggleGroupItem value="left" aria-label="Align left" size="icon">
        L
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="Align center" size="icon">
        C
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="Align right" size="icon">
        R
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};
