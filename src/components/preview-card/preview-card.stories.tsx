import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar, AvatarFallback, AvatarImage } from "../avatar";
import { PreviewCard, PreviewCardContent, PreviewCardTrigger } from "./preview-card";

const meta = {
  title: "Components/PreviewCard",
  component: PreviewCardContent,
  tags: ["autodocs"],
  args: { side: "bottom", align: "center", sideOffset: 8 },
  argTypes: {
    side: { control: "select", options: ["top", "right", "bottom", "left"] },
    align: { control: "select", options: ["start", "center", "end"] },
    sideOffset: { control: "number" },
  },
  render: (args) => (
    <div className="p-16">
      <PreviewCard>
        <PreviewCardTrigger
          href="https://example.com/filip"
          className="font-medium text-primary underline underline-offset-2"
        >
          @filip
        </PreviewCardTrigger>
        <PreviewCardContent {...args}>
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src="https://i.pravatar.cc/64?u=filip" alt="" />
              <AvatarFallback>F</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">Filip</p>
              <p className="text-muted-foreground">@filip</p>
            </div>
          </div>
          <p className="mt-2 text-muted-foreground">
            Builds Tessera, a personal component library.
          </p>
        </PreviewCardContent>
      </PreviewCard>
    </div>
  ),
} satisfies Meta<typeof PreviewCardContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Hovering (after `delay`, default 600ms) or focusing the trigger opens the card; unhovering
 * (after `closeDelay`, default 300ms), blurring or Escape closes it.
 */
export const UserLink: Story = {};

/** A link preview: destination title, domain and a short description. */
export const LinkPreview: Story = {
  render: (args) => (
    <div className="p-16">
      <PreviewCard>
        <PreviewCardTrigger
          href="https://base-ui.com"
          className="text-primary underline underline-offset-2"
        >
          Base UI
        </PreviewCardTrigger>
        <PreviewCardContent {...args}>
          <p className="font-medium">Base UI</p>
          <p className="text-muted-foreground">base-ui.com</p>
          <p className="mt-2 text-muted-foreground">
            Unstyled, accessible UI components for building high-quality web apps and design
            systems.
          </p>
        </PreviewCardContent>
      </PreviewCard>
    </div>
  ),
};

/** A trigger inline in a sentence, styled like a link. */
export const InText: Story = {
  render: (args) => (
    <p className="max-w-md p-16 text-sm leading-relaxed">
      Tessera is built on{" "}
      <PreviewCard>
        <PreviewCardTrigger
          href="https://base-ui.com"
          className="text-primary underline underline-offset-2"
        >
          Base UI
        </PreviewCardTrigger>
        <PreviewCardContent {...args}>
          <p className="font-medium">Base UI</p>
          <p className="text-muted-foreground">Unstyled component primitives for React.</p>
        </PreviewCardContent>
      </PreviewCard>{" "}
      1.8 primitives and Tailwind CSS v4, with every popup portalled and axe-clean in both themes.
    </p>
  ),
};
