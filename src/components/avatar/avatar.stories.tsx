import type { Meta, StoryObj } from "@storybook/react-vite";
import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "./index";

/** An inline SVG portrait, so the stories work offline. */
const portrait = (hue: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="hsl(${hue} 60% 80%)"/><circle cx="32" cy="26" r="12" fill="hsl(${hue} 45% 45%)"/><path d="M10 64c2-14 12-20 22-20s20 6 22 20z" fill="hsl(${hue} 45% 45%)"/></svg>`,
  )}`;

const sizes = ["sm", "md", "lg"] as const;

const meta = {
  title: "Components/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  argTypes: { size: { control: "inline-radio", options: sizes } },
  args: { size: "md" },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src={portrait(160)} alt="Ada Lovelace" />
      <AvatarFallback>AL</AvatarFallback>
    </Avatar>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {sizes.map((size) => (
        <div key={size} className="flex items-center gap-2">
          <Avatar size={size}>
            <AvatarImage src={portrait(210)} alt="Grace Hopper" />
            <AvatarFallback>GH</AvatarFallback>
          </Avatar>
          <Avatar size={size}>
            <AvatarFallback>gh</AvatarFallback>
          </Avatar>
        </div>
      ))}
    </div>
  ),
};

export const Fallback: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar>
        <AvatarImage src="data:image/png;base64,bm90LWFuLWltYWdl" alt="Linus Torvalds" />
        <AvatarFallback>LT</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>
          <User className="size-5" aria-hidden="true" />
          <span className="sr-only">Unknown user</span>
        </AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback delay={1000}>MH</AvatarFallback>
      </Avatar>
      <span className="text-muted-foreground text-sm">
        Broken image → initials · icon · fallback after a 1 s delay
      </span>
    </div>
  ),
};

const team = [
  { name: "Ada Lovelace", initials: "AL", hue: 160 },
  { name: "Grace Hopper", initials: "GH", hue: 210 },
  { name: "Margaret Hamilton", initials: "MH", hue: 20 },
  { name: "Katherine Johnson", initials: "KJ", hue: 280 },
];

export const Group: Story = {
  render: (args) => (
    <AvatarGroup role="group" aria-label="Project members">
      {team.map((member) => (
        <Avatar key={member.name} {...args}>
          <AvatarImage src={portrait(member.hue)} alt={member.name} />
          <AvatarFallback>{member.initials}</AvatarFallback>
        </Avatar>
      ))}
      <Avatar {...args}>
        <AvatarFallback>+3</AvatarFallback>
      </Avatar>
    </AvatarGroup>
  ),
};
